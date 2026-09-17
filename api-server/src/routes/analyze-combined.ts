import { Router } from 'express'
import { z } from 'zod'
import {
  analyzeCombinedTranscript,
  assessContentQuality,
  renderExchanges,
  TranscriptQualityError,
  ModelUnavailableError,
  ContractViolationError,
  SPIRAL_COLOR_PATTERN
} from '@bigfive-org/transcript-analyzer'
import type { CombinedAnalysis } from '@bigfive-org/transcript-analyzer'
import { saveCombinedAnalysis, findCombinedBySittingId } from '../db'

// POST /api/analyze-combined — contract 2.
//
// The interview arrives as EXCHANGES (question / answer / themes) plus a
// SITTING (an id that makes the call idempotent, the language, an optional
// role — never a candidate name). Four frameworks are scored in one model
// call; every quote is verbatim from a candidate answer and tagged with its
// exchange; every framework carries a headline and coverage. Errors carry a
// code so a caller can tell "don't retry" from "retry later".

export const analyzeCombinedRouter = Router()

const ExchangeSchema = z.object({
  n: z.number().int().positive(),
  question: z.string(),
  answer: z.string(),
  themes: z.array(z.string()).optional()
})

const RequestSchema = z.object({
  contract: z.literal('2'),
  sitting: z.object({
    id: z.string().min(1),
    language: z.string().optional().default('en'),
    role: z.string().optional()
  }).strict(),
  exchanges: z.array(ExchangeSchema).min(1)
}).strict()

type ErrorCode = 'INVALID_REQUEST' | 'TRANSCRIPT_TOO_SHORT' | 'MODEL_UNAVAILABLE' | 'CONTRACT_VIOLATION' | 'INTERNAL'

function fail(res: any, status: number, code: ErrorCode, message: string, details?: unknown) {
  return res.status(status).json(details === undefined ? { code, message } : { code, message, details })
}

/** The response body, from a fresh analysis or a stored one (idempotent replay). */
function responseFor(id: string, analysis: CombinedAnalysis, contentQuality: string, replayed: boolean) {
  const m = analysis.metadata
  return {
    contract: '2' as const,
    id,
    sitting: analysis.sitting,
    coverage: analysis.coverage,
    confidence: analysis.confidence,
    contentQuality,
    frameworks: analysis.frameworks,
    meta: {
      model: m.model,
      attempts: m.attempts,
      tokens: m.tokensUsed,
      ms: m.processingTime,
      quotes_dropped: m.evidenceDropped,
      spiral_lines_scrubbed: m.spiralViewScrubbed,
      seed: m.deterministicSeed,
      replayed
    }
  }
}

analyzeCombinedRouter.post('/', async (req, res) => {
  try {
    // The two v1 shapes are refused with a reason, not a generic schema error.
    if (req.body && typeof req.body === 'object') {
      if ('candidateName' in req.body) {
        return fail(res, 400, 'INVALID_REQUEST', 'candidateName is not accepted: the scorer holds no names. Identify the sitting by sitting.id.')
      }
      if ('transcript' in req.body && !('exchanges' in req.body)) {
        return fail(res, 400, 'INVALID_REQUEST', 'Contract 2 takes the interview as exchanges [{n, question, answer, themes}], not a transcript string.')
      }
    }
    const parsed = RequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'INVALID_REQUEST', 'Request does not match contract 2', parsed.error.errors)
    }
    const { sitting, exchanges } = parsed.data

    // Idempotent: the same sitting scored once returns the same result.
    const existing = await findCombinedBySittingId(sitting.id)
    if (existing) {
      return res.json(responseFor(existing.id, existing.analysis, existing.contentQuality, true))
    }

    const transcript = renderExchanges(exchanges)
    const quality = assessContentQuality(transcript)
    if (quality.warnings.length > 0) {
      console.warn('Quality warnings (combined):', quality.warnings)
    }

    const analysis = await analyzeCombinedTranscript({ exchanges, sitting, language: sitting.language, jobRole: sitting.role })

    // RESPONSE-LAYER Spiral privacy enforcement (defense in depth on top of the
    // analyzer's own retry+scrub): no vMEME color label ever leaves this route
    // in an employer-facing string.
    analysis.frameworks.spiral.employer_view =
      analysis.frameworks.spiral.employer_view.filter(s => !SPIRAL_COLOR_PATTERN.test(s))
    analysis.frameworks.spiral.headline = analysis.frameworks.spiral.employer_view[0] ?? ''

    // Persist the RESULT only — no transcript text, no name.
    const resultId = await saveCombinedAnalysis({
      sitting,
      exchangeCount: exchanges.length,
      transcriptLength: transcript.length,
      contentQuality: quality.estimatedQuality,
      analysis
    })

    res.json(responseFor(resultId, analysis, quality.estimatedQuality, false))

  } catch (error) {
    if (error instanceof TranscriptQualityError) {
      return fail(res, 400, 'TRANSCRIPT_TOO_SHORT', error.message)
    }
    if (error instanceof ModelUnavailableError) {
      console.error('Combined analysis: model unavailable:', error.message)
      return fail(res, 502, 'MODEL_UNAVAILABLE', error.message)
    }
    if (error instanceof ContractViolationError) {
      console.error('Combined analysis: contract violation:', error.message)
      return fail(res, 502, 'CONTRACT_VIOLATION', error.message)
    }
    console.error('Combined analysis error:', error)
    return fail(res, 500, 'INTERNAL', error instanceof Error ? error.message : 'Combined analysis failed')
  }
})
