import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import {
  analyzeCombinedTranscript,
  assessContentQuality,
  renderExchanges,
  answeredExchanges,
  cleanLines,
  headlineOf,
  TranscriptQualityError,
  ModelUnavailableError,
  ModelAuthError,
  ModelQuotaError,
  ModelRejectedRequestError,
  ContractViolationError,
  SPIRAL_COLOR_PATTERN
} from '@bigfive-org/transcript-analyzer'
import type { CombinedAnalysis, Exchange } from '@bigfive-org/transcript-analyzer'
import { saveCombinedAnalysis, findCombinedBySittingId, DuplicateSittingError } from '../db'
import type { StoredCombined } from '../db'
import type { AuthRequest } from '../middleware/auth'

// POST /api/analyze-combined — contract 2.
//
// The interview arrives as EXCHANGES (question / answer / themes) plus a
// SITTING (an id that makes the call idempotent, the language, an optional
// role — never a candidate name). Four frameworks are scored in one model
// call; every quote is verbatim from a candidate answer and tagged with its
// exchange; every framework carries a headline and coverage. Errors carry a
// code and a retry flag so a caller can tell "don't retry" from "retry later".
//
// Idempotency is scoped to the CALLER: the key is (owner, sitting.id), where
// owner is a hash of the API key ('public' without one), and it is enforced
// by a unique index in the database. A reused id with DIFFERENT content is a
// client fault (409), never someone else's result.

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

type ErrorCode =
  | 'INVALID_REQUEST' | 'TRANSCRIPT_TOO_SHORT' | 'TRANSCRIPT_TOO_LONG' | 'SITTING_CONFLICT'
  | 'MODEL_UNAVAILABLE' | 'CONTRACT_VIOLATION' | 'MODEL_AUTH' | 'MODEL_QUOTA' | 'MODEL_REJECTED' | 'INTERNAL'

function fail(res: any, status: number, code: ErrorCode, retry: boolean, message: string, details?: unknown) {
  const body: Record<string, unknown> = { code, retry, message }
  if (details !== undefined) body.details = details
  return res.status(status).json(body)
}

/** The caller's idempotency scope: never the raw key, never absent. */
function ownerOf(req: AuthRequest): string {
  return req.apiKey ? `key:${crypto.createHash('sha256').update(req.apiKey).digest('hex').slice(0, 16)}` : 'public'
}

/** What was actually said, hashed — so a reused sitting id with different answers is caught. */
function fingerprintOf(answered: Exchange[]): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify(answered.map(e => [e.n, e.answer])))
    .digest('hex')
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

/** Replay a stored result — but only if it is the SAME interview. */
function replay(res: any, existing: StoredCombined, fingerprint: string, sittingId: string) {
  if (existing.fingerprint && existing.fingerprint !== fingerprint) {
    return fail(res, 409, 'SITTING_CONFLICT', false,
      `Sitting ${sittingId} was already scored with different answers. A sitting id identifies one interview; use a new id for new content.`)
  }
  return res.json(responseFor(existing.id, existing.analysis, existing.contentQuality, true))
}

analyzeCombinedRouter.post('/', async (req, res) => {
  try {
    // The two v1 shapes are refused with a reason, not a generic schema error.
    if (req.body && typeof req.body === 'object') {
      if ('candidateName' in req.body) {
        return fail(res, 400, 'INVALID_REQUEST', false, 'candidateName is not accepted: the scorer holds no names. Identify the sitting by sitting.id.')
      }
      if ('transcript' in req.body && !('exchanges' in req.body)) {
        return fail(res, 400, 'INVALID_REQUEST', false, 'Contract 2 takes the interview as exchanges [{n, question, answer, themes}], not a transcript string.')
      }
    }
    const parsed = RequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'INVALID_REQUEST', false, 'Request does not match contract 2', parsed.error.errors)
    }
    const { sitting, exchanges } = parsed.data
    const owner = ownerOf(req as AuthRequest)
    const answered = answeredExchanges(exchanges)
    const fingerprint = fingerprintOf(answered)

    // Idempotent: the same sitting, from the same caller, scored once.
    const existing = await findCombinedBySittingId(owner, sitting.id)
    if (existing) return replay(res, existing, fingerprint, sitting.id)

    const transcript = renderExchanges(answered)
    const quality = assessContentQuality(transcript)
    if (quality.warnings.length > 0) {
      console.warn('Quality warnings (combined):', quality.warnings)
    }

    const analysis = await analyzeCombinedTranscript({ exchanges, sitting, language: sitting.language, jobRole: sitting.role })

    // RESPONSE-LAYER Spiral privacy enforcement (defense in depth on top of the
    // analyzer's own retry+scrub): no vMEME color label ever leaves this route
    // in an employer-facing string. Same normalisation and headline rule as the analyzer.
    const spiral = analysis.frameworks.spiral
    spiral.employer_view = cleanLines(spiral.employer_view).filter(s => !SPIRAL_COLOR_PATTERN.test(s))
    spiral.headline = headlineOf(spiral.employer_view)

    // Persist the RESULT only — no transcript text, no name. If the unique
    // index says a concurrent request already stored this sitting, replay that.
    let resultId: string
    try {
      resultId = await saveCombinedAnalysis({
        owner,
        sitting,
        fingerprint,
        exchangeCount: answered.length,
        transcriptLength: transcript.length,
        contentQuality: quality.estimatedQuality,
        analysis
      })
    } catch (err) {
      if (err instanceof DuplicateSittingError) {
        const stored = await findCombinedBySittingId(owner, sitting.id)
        if (stored) return replay(res, stored, fingerprint, sitting.id)
      }
      throw err
    }

    res.json(responseFor(resultId, analysis, quality.estimatedQuality, false))

  } catch (error) {
    if (error instanceof TranscriptQualityError) {
      return fail(res, 400, 'TRANSCRIPT_TOO_SHORT', false, error.message)
    }
    if (error instanceof ModelRejectedRequestError) {
      console.error('Combined analysis: model rejected the request:', error.message)
      if (error.code === 'context_length_exceeded') {
        return fail(res, 422, 'TRANSCRIPT_TOO_LONG', false, 'The interview is too long for the model in one call.')
      }
      return fail(res, 502, 'MODEL_REJECTED', false, error.message)
    }
    if (error instanceof ModelAuthError) {
      console.error('Combined analysis: model credentials refused:', error.message)
      return fail(res, 500, 'MODEL_AUTH', false, 'The scorer is misconfigured: the model refused its credentials.')
    }
    if (error instanceof ModelQuotaError) {
      console.error('Combined analysis: model quota exhausted:', error.message)
      return fail(res, 503, 'MODEL_QUOTA', false, 'The scorer is out of model quota.')
    }
    if (error instanceof ModelUnavailableError) {
      console.error('Combined analysis: model unavailable:', error.message)
      return fail(res, 502, 'MODEL_UNAVAILABLE', true, error.message)
    }
    if (error instanceof ContractViolationError) {
      console.error('Combined analysis: contract violation:', error.message)
      return fail(res, 502, 'CONTRACT_VIOLATION', true, error.message)
    }
    console.error('Combined analysis error:', error)
    return fail(res, 500, 'INTERNAL', false, error instanceof Error ? error.message : 'Combined analysis failed')
  }
})
