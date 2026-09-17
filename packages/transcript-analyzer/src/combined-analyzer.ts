// Combined four-framework analyzer (OCEAN + SDT + JD-R + Spiral Dynamics).
// ADDITIVE module — the existing OCEAN-only TranscriptAnalyzer is untouched.
//
// One GPT call scores all four frameworks in the fork's analyzer style:
// temperature 0.1, deterministic content-hash seed, JSON response format,
// hard structural validation. On soft contract violations (non-verbatim
// evidence anywhere, Spiral color labels in employer_view) it retries ONCE
// with a corrective message; if violations persist the response is sanitized
// (offending evidence dropped, offending employer_view strings stripped).
//
// V1 sheets: SDT (18 items) and JD-R (35 HSE MSIT items) are ANSWERED by the
// model as the candidate and SCORED here — sum, average, the shared
// calculateResult cut-offs — exactly like the OCEAN facets. The model never
// decides a level for those two.

import OpenAI from 'openai'
import crypto from 'crypto'
import type {
  CombinedTranscriptInput,
  CombinedAnalysis,
  CombinedFrameworks,
  CombinedGPTRawOutput,
  ChatCompletionsClient,
  OceanDomainKey,
  SheetScaleProfile,
  SpiralOrientationKey,
  RawScaleEvidence
} from './combined-types'
import { calculateResult } from './transformer'
import {
  COMBINED_SYSTEM_PROMPT,
  buildCombinedAnalysisPrompt,
  buildCorrectionPrompt
} from './prompts/combined-assessment'
import { assessContentQuality, shouldProceedWithAnalysis, getQualityScore } from './content-validator'
import { scoreSheet, validateSheetAnswers } from './instruments/score-sheet'
import type { SheetScaleScore } from './instruments/score-sheet'
import { SDT_ITEMS, SDT_NEEDS } from './instruments/sdt-needs'
import type { SdtNeedKey } from './instruments/sdt-needs'
import { HSE_MSIT_ITEMS, HSE_MSIT_SCALES } from './instruments/hse-msit'
import type { JdrScaleKey } from './instruments/hse-msit'

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const OCEAN_DOMAINS: OceanDomainKey[] = ['O', 'C', 'E', 'A', 'N']
const REQUIRED_FACETS = ['1', '2', '3', '4', '5', '6']
const SDT_KEYS = SDT_NEEDS.map(n => n.key)
const JDR_KEYS = HSE_MSIT_SCALES.map(s => s.key)
const SPIRAL_KEYS: SpiralOrientationKey[] = [
  'structure_oriented', 'achievement_oriented', 'people_oriented', 'systems_oriented'
]

// vMEME color labels must never reach an employer-facing Spiral string.
// (No /g flag — a global regex is stateful across .test() calls.)
export const SPIRAL_COLOR_PATTERN = /\b(blue|orange|green|yellow|turquoise|red|purple|beige)\b/i

/** Thrown when the transcript fails the content-quality gate (a client error, not a server fault). */
export class TranscriptQualityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptQualityError'
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Return the exact transcript substring matching `quote`, or null.
 * Accepts whitespace-normalized matches but always returns the transcript's
 * own characters, so the result is verbatim by construction.
 */
export function findVerbatimEvidence(transcript: string, quote: string): string | null {
  const trimmed = quote.trim()
  if (!trimmed) return null
  if (transcript.includes(trimmed)) return trimmed
  const tokens = trimmed.split(/\s+/).map(escapeRegExp)
  if (tokens.length === 0) return null
  const match = transcript.match(new RegExp(tokens.join('\\s+')))
  return match ? match[0] : null
}

/** Split employer-view strings into clean vs color-label violations. */
export function scrubSpiralEmployerView(view: string[]): { clean: string[]; violations: string[] } {
  const clean: string[] = []
  const violations: string[] = []
  for (const s of view) {
    if (SPIRAL_COLOR_PATTERN.test(s)) violations.push(s)
    else clean.push(s)
  }
  return { clean, violations }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new Error(`Invalid output: ${label} must be an array of strings`)
  }
}

function assertScaleEvidence(value: unknown, label: string): asserts value is RawScaleEvidence {
  if (value === undefined) return
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid output: ${label} must be an object`)
  }
  const v = value as RawScaleEvidence
  if (v.reasoning !== undefined && typeof v.reasoning !== 'string') {
    throw new Error(`Invalid output: ${label}.reasoning must be a string`)
  }
  if (v.evidence !== undefined) assertStringArray(v.evidence, `${label}.evidence`)
}

function assertScore0to100(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new Error(`Invalid output: ${label} must be a number between 0 and 100`)
  }
}

/** Hard structural validation — mirrors the existing analyzer's validateGPTOutput discipline. */
export function validateCombinedOutput(output: any): asserts output is CombinedGPTRawOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('Invalid output: not a JSON object')
  }

  // OCEAN
  if (!output.ocean?.domains || typeof output.ocean.domains !== 'object') {
    throw new Error('Invalid output: missing ocean.domains object')
  }
  OCEAN_DOMAINS.forEach(domain => {
    const d = output.ocean.domains[domain]
    if (!d?.facets) {
      throw new Error(`Invalid output: missing facets for ocean domain ${domain}`)
    }
    REQUIRED_FACETS.forEach(facet => {
      const score = d.facets[facet]
      if (typeof score !== 'number' || score < 1 || score > 5) {
        throw new Error(`Invalid score for ${domain}-${facet}: ${score}`)
      }
    })
    if (d.reasoning !== undefined && typeof d.reasoning !== 'string') {
      throw new Error(`Invalid output: ocean.${domain}.reasoning must be a string`)
    }
    if (d.evidence !== undefined) assertStringArray(d.evidence, `ocean.${domain}.evidence`)
  })
  assertStringArray(output.ocean.employer_view, 'ocean.employer_view')

  // SDT — the 18-item sheet
  if (!output.sdt || typeof output.sdt !== 'object') {
    throw new Error('Invalid output: missing sdt object')
  }
  validateSheetAnswers(SDT_ITEMS, output.sdt.answers, 'sdt')
  if (output.sdt.scales !== undefined && (!output.sdt.scales || typeof output.sdt.scales !== 'object')) {
    throw new Error('Invalid output: sdt.scales must be an object')
  }
  SDT_KEYS.forEach(k => assertScaleEvidence(output.sdt.scales?.[k], `sdt.scales.${k}`))
  if (output.sdt.dominant_drivers !== undefined) {
    assertStringArray(output.sdt.dominant_drivers, 'sdt.dominant_drivers')
  }
  assertStringArray(output.sdt.employer_view, 'sdt.employer_view')

  // JD-R — the 35-item HSE sheet
  if (!output.jdr || typeof output.jdr !== 'object') {
    throw new Error('Invalid output: missing jdr object')
  }
  validateSheetAnswers(HSE_MSIT_ITEMS, output.jdr.answers, 'jdr')
  if (output.jdr.scales !== undefined && (!output.jdr.scales || typeof output.jdr.scales !== 'object')) {
    throw new Error('Invalid output: jdr.scales must be an object')
  }
  JDR_KEYS.forEach(k => assertScaleEvidence(output.jdr.scales?.[k], `jdr.scales.${k}`))
  if (output.jdr.sustainability !== undefined && typeof output.jdr.sustainability !== 'string') {
    throw new Error('Invalid output: jdr.sustainability must be a string')
  }
  assertStringArray(output.jdr.employer_view, 'jdr.employer_view')

  // Spiral — real validation of every number (was: "is an object")
  const sp = output.spiral?.profile
  if (!sp || typeof sp !== 'object') {
    throw new Error('Invalid output: missing spiral.profile object')
  }
  SPIRAL_KEYS.forEach(k => assertScore0to100(sp[k], `spiral.profile.${k}`))
  for (const field of ['dominant_orientation', 'secondary_orientation'] as const) {
    if (sp[field] !== undefined && typeof sp[field] !== 'string') {
      throw new Error(`Invalid output: spiral.profile.${field} must be a string`)
    }
  }
  if (sp.orientation_evidence !== undefined) {
    if (!sp.orientation_evidence || typeof sp.orientation_evidence !== 'object') {
      throw new Error('Invalid output: spiral.profile.orientation_evidence must be an object')
    }
    SPIRAL_KEYS.forEach(k => assertScaleEvidence(sp.orientation_evidence[k], `spiral.profile.orientation_evidence.${k}`))
  }
  for (const field of ['communication_style', 'summary'] as const) {
    if (sp[field] !== undefined && typeof sp[field] !== 'string') {
      throw new Error(`Invalid output: spiral.profile.${field} must be a string`)
    }
  }
  for (const field of ['culture_fit_indicators', 'internal_tags'] as const) {
    if (sp[field] !== undefined) assertStringArray(sp[field], `spiral.profile.${field}`)
  }
  assertStringArray(output.spiral.employer_view, 'spiral.employer_view')

  // Confidence
  if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
    throw new Error('Invalid output: confidence must be a number between 0 and 1')
  }
}

export class CombinedAnalyzer {
  private client: ChatCompletionsClient
  private model: string

  constructor(apiKey: string, options?: { client?: ChatCompletionsClient; model?: string }) {
    this.client = options?.client || (new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    }) as unknown as ChatCompletionsClient)
    this.model = options?.model || OPENAI_MODEL
  }

  async analyze(input: CombinedTranscriptInput): Promise<CombinedAnalysis> {
    const startTime = Date.now()

    const quality = assessContentQuality(input.text)
    const { proceed, reason } = shouldProceedWithAnalysis(quality)
    if (!proceed) {
      throw new TranscriptQualityError(reason || 'Transcript quality is insufficient for analysis')
    }

    // Deterministic seed for repeatability (same recipe as the OCEAN analyzer)
    const transcriptHash = crypto.createHash('md5').update(input.text).digest('hex')
    const seed = parseInt(transcriptHash.substring(0, 8), 16) % 1000000

    const baseMessages = [
      { role: 'system', content: COMBINED_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildCombinedAnalysisPrompt(input.text, {
          candidateName: input.candidateName,
          jobRole: input.jobRole
        })
      }
    ]

    let messages = baseMessages
    let totalTokens = 0
    let systemFingerprint: string | undefined
    let raw: CombinedGPTRawOutput | null = null
    const maxAttempts = 2
    let attempt = 0

    while (attempt < maxAttempts) {
      attempt++
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        seed,
        messages
      })

      totalTokens += response.usage?.total_tokens || 0
      systemFingerprint = response.system_fingerprint || systemFingerprint

      const content = response.choices[0]?.message?.content
      if (!content) {
        if (attempt < maxAttempts) continue
        throw new Error('No content received from OpenAI')
      }

      let parsed: any
      try {
        parsed = JSON.parse(content)
        validateCombinedOutput(parsed)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (attempt < maxAttempts) {
          messages = [...baseMessages, {
            role: 'user',
            content: buildCorrectionPrompt([`Structural problem: ${message}`])
          }]
          continue
        }
        throw new Error(`Failed to analyze transcript (combined): ${message}`)
      }

      // Soft contract violations: non-verbatim evidence + Spiral color labels
      const violations = this.collectSoftViolations(parsed, input.text)
      if (violations.length === 0 || attempt >= maxAttempts) {
        raw = parsed
        break
      }
      messages = [...baseMessages, { role: 'user', content: buildCorrectionPrompt(violations) }]
    }

    if (!raw) {
      throw new Error('Failed to analyze transcript (combined): no valid response')
    }

    // Sanitize any violations that survived the retry
    const { frameworks, evidenceDropped, spiralViewScrubbed } = this.toFrameworks(raw, input.text)

    return {
      frameworks,
      confidence: raw.confidence,
      metadata: {
        model: this.model,
        timestamp: new Date(),
        transcriptLength: input.text.length,
        tokensUsed: totalTokens,
        processingTime: Date.now() - startTime,
        contentQuality: quality.estimatedQuality,
        contentQualityScore: getQualityScore(quality),
        deterministicSeed: seed,
        systemFingerprint,
        attempts: attempt,
        evidenceDropped,
        spiralViewScrubbed
      }
    }
  }

  /** Every (label, evidence[]) pair in the raw output — one walk used by both the retry and the sanitizer. */
  private evidenceSites(raw: CombinedGPTRawOutput): Array<{ label: string; evidence: string[] }> {
    const sites: Array<{ label: string; evidence: string[] }> = []
    OCEAN_DOMAINS.forEach(d => sites.push({ label: `ocean.${d}`, evidence: raw.ocean.domains[d]?.evidence || [] }))
    SDT_KEYS.forEach(k => sites.push({ label: `sdt.scales.${k}`, evidence: raw.sdt.scales?.[k]?.evidence || [] }))
    JDR_KEYS.forEach(k => sites.push({ label: `jdr.scales.${k}`, evidence: raw.jdr.scales?.[k]?.evidence || [] }))
    SPIRAL_KEYS.forEach(k => sites.push({
      label: `spiral.profile.orientation_evidence.${k}`,
      evidence: raw.spiral.profile.orientation_evidence?.[k]?.evidence || []
    }))
    return sites
  }

  private collectSoftViolations(raw: CombinedGPTRawOutput, transcript: string): string[] {
    const violations: string[] = []

    for (const { label, evidence } of this.evidenceSites(raw)) {
      evidence.forEach(quote => {
        if (!findVerbatimEvidence(transcript, quote)) {
          violations.push(`${label} evidence is not a verbatim transcript substring: "${quote.slice(0, 120)}"`)
        }
      })
    }

    const { violations: spiralViolations } = scrubSpiralEmployerView(raw.spiral.employer_view)
    spiralViolations.forEach(s => {
      violations.push(`spiral.employer_view contains a Spiral color label: "${s.slice(0, 120)}"`)
    })

    return violations
  }

  private toFrameworks(raw: CombinedGPTRawOutput, transcript: string): {
    frameworks: CombinedFrameworks
    evidenceDropped: number
    spiralViewScrubbed: number
  } {
    let evidenceDropped = 0

    // Keep only quotes that are really in the transcript (verbatim by construction).
    const verbatim = (quotes: string[] | undefined): string[] => {
      const kept: string[] = []
      for (const quote of quotes || []) {
        const v = findVerbatimEvidence(transcript, quote)
        if (v) kept.push(v)
        else evidenceDropped++
      }
      return kept
    }

    const withEvidence = (score: SheetScaleScore, ev: RawScaleEvidence | undefined): SheetScaleProfile => ({
      ...score,
      reasoning: ev?.reasoning || '',
      evidence: verbatim(ev?.evidence)
    })

    // OCEAN — unchanged
    const oceanProfile = {} as CombinedFrameworks['ocean']['profile']
    OCEAN_DOMAINS.forEach(domain => {
      const d = raw.ocean.domains[domain]
      const sum = REQUIRED_FACETS.reduce((acc, f) => acc + d.facets[f], 0)
      oceanProfile[domain] = {
        score: sum, // 6-30
        average: Math.round((sum / 6) * 100) / 100, // 1-5
        level: calculateResult(sum, 6),
        reasoning: d.reasoning || '',
        evidence: verbatim(d.evidence)
      }
    })

    // SDT — score the sheet
    const sdtScores = scoreSheet(SDT_ITEMS, raw.sdt.answers)
    const sdtScales = {} as Record<SdtNeedKey, SheetScaleProfile>
    SDT_KEYS.forEach(k => { sdtScales[k] = withEvidence(sdtScores[k], raw.sdt.scales?.[k]) })
    // Dominant drivers are the two highest-scoring needs — computed, never the
    // model's pick (the calculator decides; ties keep key order via stable sort).
    const dominantDrivers = [...SDT_KEYS]
      .sort((a, b) => sdtScores[b].average - sdtScores[a].average)
      .slice(0, 2)

    // JD-R — score the sheet
    const jdrScores = scoreSheet(HSE_MSIT_ITEMS, raw.jdr.answers)
    const jdrScales = {} as Record<JdrScaleKey, SheetScaleProfile>
    JDR_KEYS.forEach(k => { jdrScales[k] = withEvidence(jdrScores[k], raw.jdr.scales?.[k]) })

    // Spiral — orientations with evidence; profile stays internal-only
    const sp = raw.spiral.profile
    const orientations = {} as Record<SpiralOrientationKey, CombinedFrameworks['spiral']['profile']['orientations'][SpiralOrientationKey]>
    SPIRAL_KEYS.forEach(k => {
      const ev = sp.orientation_evidence?.[k]
      orientations[k] = { score: sp[k], reasoning: ev?.reasoning || '', evidence: verbatim(ev?.evidence) }
    })
    // Dominant / secondary orientation are the two highest scores — computed,
    // never the model's pick (ties keep key order via stable sort).
    const [dominantOrientation, secondaryOrientation] = [...SPIRAL_KEYS]
      .sort((a, b) => sp[b] - sp[a])
    const { clean: spiralView, violations } = scrubSpiralEmployerView(raw.spiral.employer_view)

    const frameworks: CombinedFrameworks = {
      ocean: {
        profile: oceanProfile,
        employer_view: raw.ocean.employer_view
      },
      sdt: {
        profile: {
          ...sdtScales,
          dominant_drivers: dominantDrivers,
          answers: raw.sdt.answers,
          instrument: 'byall-sdt-needs-v1'
        },
        employer_view: raw.sdt.employer_view
      },
      jdr: {
        profile: {
          scales: jdrScales,
          sustainability: raw.jdr.sustainability || '',
          answers: raw.jdr.answers,
          instrument: 'hse-msit-v1'
        },
        employer_view: raw.jdr.employer_view
      },
      spiral: {
        profile: {
          orientations,
          dominant_orientation: dominantOrientation,
          secondary_orientation: secondaryOrientation,
          communication_style: sp.communication_style || '',
          culture_fit_indicators: sp.culture_fit_indicators || [],
          internal_tags: sp.internal_tags || [],
          summary: sp.summary || '',
          instrument: 'byall-spiral-rubric-v1'
        },
        employer_view: spiralView
      }
    }

    return { frameworks, evidenceDropped, spiralViewScrubbed: violations.length }
  }
}

export async function analyzeCombinedTranscript(
  input: CombinedTranscriptInput,
  apiKey?: string
): Promise<CombinedAnalysis> {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey parameter.')
  }
  const analyzer = new CombinedAnalyzer(key)
  return analyzer.analyze(input)
}

