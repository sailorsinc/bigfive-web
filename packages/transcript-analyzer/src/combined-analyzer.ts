// Combined four-framework analyzer (OCEAN + SDT + JD-R + Spiral Dynamics).
// THE analyzer — the Big Five-only `analyzeTranscript` is a view over this one
// (ocean-analysis.ts, design D4). There is no second implementation.
//
// One GPT call scores all four frameworks: temperature 0.1, deterministic
// content-hash seed, JSON response format, hard structural validation. On soft
// contract violations (a quote that is not verbatim in a candidate ANSWER,
// Spiral color labels in employer_view) it retries ONCE with a corrective
// message; if violations persist the response is sanitized (offending quotes
// dropped, offending employer_view strings stripped) and counted.
//
// Everything is a sheet: Big Five (120 IPIP-NEO items), SDT (18) and JD-R
// (35 HSE MSIT items) are ANSWERED by the model as the candidate and SCORED
// here through one arithmetic (instruments/score-sheet.ts). The model never
// decides a level. Spiral has no open instrument: four judged numbers,
// validated, labelled as byall's own rubric.
//
// Contract 2: input is the interview as EXCHANGES; quotes are matched against
// candidate answers only and tagged with their exchange; the result carries
// per-framework coverage and a headline. The plain-text path (`text`) remains
// for the website, where quotes match the whole text and carry no exchange.

import OpenAI from 'openai'
import crypto from 'crypto'
import type {
  CombinedTranscriptInput,
  CombinedAnalysis,
  CombinedFrameworks,
  CombinedGPTRawOutput,
  ChatCompletionsClient,
  Coverage,
  Exchange,
  EvidenceQuote,
  FrameworkCoverage,
  FrameworkKey,
  OceanDomainKey,
  OceanDomainProfile,
  SheetScaleProfile,
  SpiralOrientationKey,
  RawScaleEvidence
} from './combined-types'
import {
  COMBINED_SYSTEM_PROMPT,
  buildCombinedAnalysisPrompt,
  buildCorrectionPrompt,
  renderExchanges
} from './prompts/combined-assessment'
import { assessContentQuality, shouldProceedWithAnalysis, getQualityScore } from './content-validator'
import { answeredExchanges, cleanLines, headlineOf } from './exchanges'
import { scoreSheet, validateSheetAnswers, countNeutralAnswers } from './instruments/score-sheet'
import type { SheetScaleScore } from './instruments/score-sheet'
import { OCEAN_ITEMS, OCEAN_DOMAINS, scoreOcean } from './instruments/ipip-neo-120'
import { SDT_ITEMS, SDT_NEEDS } from './instruments/sdt-needs'
import type { SdtNeedKey } from './instruments/sdt-needs'
import { HSE_MSIT_ITEMS, HSE_MSIT_SCALES } from './instruments/hse-msit'
import type { JdrScaleKey } from './instruments/hse-msit'

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const SDT_KEYS = SDT_NEEDS.map(n => n.key)
const JDR_KEYS = HSE_MSIT_SCALES.map(s => s.key)
const SPIRAL_KEYS: SpiralOrientationKey[] = [
  'structure_oriented', 'achievement_oriented', 'people_oriented', 'systems_oriented'
]

// Which interview themes aim at which framework (byall's eight-theme skeleton).
export const THEME_FRAMEWORK: Record<string, FrameworkKey> = {
  openness: 'ocean', conscientiousness: 'ocean', extraversion: 'ocean',
  agreeableness: 'ocean', 'emotional stability': 'ocean',
  motivation: 'sdt', energy: 'jdr', values: 'spiral'
}

// vMEME color labels must never reach an employer-facing Spiral string.
// (No /g flag — a global regex is stateful across .test() calls.)
export const SPIRAL_COLOR_PATTERN = /\b(blue|orange|green|yellow|turquoise|red|purple|beige)\b/i

// ---------------------------------------------------------------------------
// Typed errors — the route maps these to error codes (400 / 502); anything
// else is INTERNAL (500).

/** The transcript fails the content-quality gate. A client error; don't retry. */
export class TranscriptQualityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptQualityError'
  }
}

/** The model could not be reached, timed out, rate-limited us, or answered with nothing. Retry later. */
export class ModelUnavailableError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ModelUnavailableError'
    this.cause = cause
  }
}

/** Our credentials were refused (401/403). A configuration fault — retrying will not help. */
export class ModelAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelAuthError'
  }
}

/** The account is out of quota (429 insufficient_quota). Needs a human — retrying will not help. */
export class ModelQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelQuotaError'
  }
}

/** The model rejected THIS request (400/404/413/422 — e.g. context_length_exceeded). Retrying the same request will not help. */
export class ModelRejectedRequestError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ModelRejectedRequestError'
    this.code = code
  }
}

/**
 * Sort a failure from the OpenAI SDK into the four classes above by its HTTP
 * status and error code (duck-typed on the SDK's APIError shape, so a fake
 * client in tests can throw the same shapes). Anything without a status is a
 * connection-level failure -> unavailable.
 */
export function classifyModelError(err: unknown): Error {
  const e = err as { status?: unknown; code?: unknown; type?: unknown; message?: unknown }
  const status = typeof e?.status === 'number' ? e.status : undefined
  const code = typeof e?.code === 'string' ? e.code : (typeof e?.type === 'string' ? e.type : undefined)
  const message = err instanceof Error ? err.message : String(err)
  if (status === 401 || status === 403) return new ModelAuthError(`The model refused our credentials (${status}): ${message}`)
  if (status === 429 && code === 'insufficient_quota') return new ModelQuotaError(`The model account is out of quota: ${message}`)
  if (status !== undefined && status >= 400 && status < 500 && status !== 429 && status !== 408) {
    return new ModelRejectedRequestError(`The model rejected the request (${status}${code ? ` ${code}` : ''}): ${message}`, code)
  }
  return new ModelUnavailableError(`The model could not be reached: ${message}`, err)
}

/** The model answered, but not in the contract, even after one corrective retry. Retry later. */
export class ContractViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractViolationError'
  }
}

// ---------------------------------------------------------------------------
// Evidence: verbatim, from candidate answers only

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Return the exact substring of `haystack` matching `quote`, or null.
 * Accepts whitespace-normalized matches but always returns the haystack's own
 * characters, so the result is verbatim by construction.
 */
export function findVerbatimEvidence(haystack: string, quote: string): string | null {
  const trimmed = quote.trim()
  if (!trimmed) return null
  if (haystack.includes(trimmed)) return trimmed
  const tokens = trimmed.split(/\s+/).map(escapeRegExp)
  if (tokens.length === 0) return null
  const match = haystack.match(new RegExp(tokens.join('\\s+')))
  return match ? match[0] : null
}

/**
 * Where quotes may come from. With exchanges: each candidate ANSWER, so a
 * phrase that appears only in a question is rejected. Plain text: the whole
 * text, no exchange number.
 */
export class EvidenceLocator {
  private readonly sources: Array<{ text: string; exchange?: number }>

  constructor(exchanges?: Exchange[], text?: string) {
    this.sources = exchanges
      ? answeredExchanges(exchanges).map(e => ({ text: e.answer, exchange: e.n }))
      : [{ text: text || '' }]
  }

  locate(quote: string): EvidenceQuote | null {
    for (const src of this.sources) {
      const found = findVerbatimEvidence(src.text, quote)
      if (found) return src.exchange === undefined ? { text: found } : { text: found, exchange: src.exchange }
    }
    return null
  }
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

// ---------------------------------------------------------------------------
// Hard validation

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new Error(`Invalid output: ${label} must be an array of strings`)
  }
}

/** Optional fields: absent and null both mean "nothing here" (JSON-mode models emit null for that). */
const absent = (v: unknown): boolean => v === undefined || v === null

function assertScaleEvidence(value: unknown, label: string): asserts value is RawScaleEvidence {
  if (absent(value)) return
  if (typeof value !== 'object') {
    throw new Error(`Invalid output: ${label} must be an object`)
  }
  const v = value as RawScaleEvidence
  if (!absent(v.reasoning) && typeof v.reasoning !== 'string') {
    throw new Error(`Invalid output: ${label}.reasoning must be a string`)
  }
  if (!absent(v.evidence)) assertStringArray(v.evidence, `${label}.evidence`)
}

function assertScore0to100(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new Error(`Invalid output: ${label} must be a number between 0 and 100`)
  }
}

function assertOptionalConfidence(value: unknown, label: string): void {
  if (!absent(value) && (typeof value !== 'number' || value < 0 || value > 1)) {
    throw new Error(`Invalid output: ${label} must be a number between 0 and 1`)
  }
}

/** Hard structural validation of the model's JSON. Throws a plain Error naming the first problem. */
export function validateCombinedOutput(output: any): asserts output is CombinedGPTRawOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('Invalid output: not a JSON object')
  }

  // OCEAN — the 120-item IPIP sheet
  if (!output.ocean || typeof output.ocean !== 'object') {
    throw new Error('Invalid output: missing ocean object')
  }
  validateSheetAnswers(OCEAN_ITEMS, output.ocean.answers, 'ocean')
  if (!absent(output.ocean.domains) && typeof output.ocean.domains !== 'object') {
    throw new Error('Invalid output: ocean.domains must be an object')
  }
  OCEAN_DOMAINS.forEach(d => assertScaleEvidence(output.ocean.domains?.[d], `ocean.domains.${d}`))
  assertStringArray(output.ocean.employer_view, 'ocean.employer_view')
  assertOptionalConfidence(output.ocean.confidence, 'ocean.confidence')

  // SDT — the 18-item sheet
  if (!output.sdt || typeof output.sdt !== 'object') {
    throw new Error('Invalid output: missing sdt object')
  }
  validateSheetAnswers(SDT_ITEMS, output.sdt.answers, 'sdt')
  if (!absent(output.sdt.scales) && typeof output.sdt.scales !== 'object') {
    throw new Error('Invalid output: sdt.scales must be an object')
  }
  SDT_KEYS.forEach(k => assertScaleEvidence(output.sdt.scales?.[k], `sdt.scales.${k}`))
  if (!absent(output.sdt.dominant_drivers)) {
    assertStringArray(output.sdt.dominant_drivers, 'sdt.dominant_drivers')
  }
  assertStringArray(output.sdt.employer_view, 'sdt.employer_view')
  assertOptionalConfidence(output.sdt.confidence, 'sdt.confidence')

  // JD-R — the 35-item HSE sheet
  if (!output.jdr || typeof output.jdr !== 'object') {
    throw new Error('Invalid output: missing jdr object')
  }
  validateSheetAnswers(HSE_MSIT_ITEMS, output.jdr.answers, 'jdr')
  if (!absent(output.jdr.scales) && typeof output.jdr.scales !== 'object') {
    throw new Error('Invalid output: jdr.scales must be an object')
  }
  JDR_KEYS.forEach(k => assertScaleEvidence(output.jdr.scales?.[k], `jdr.scales.${k}`))
  if (!absent(output.jdr.sustainability) && typeof output.jdr.sustainability !== 'string') {
    throw new Error('Invalid output: jdr.sustainability must be a string')
  }
  assertStringArray(output.jdr.employer_view, 'jdr.employer_view')
  assertOptionalConfidence(output.jdr.confidence, 'jdr.confidence')

  // Spiral — every number really checked
  const sp = output.spiral?.profile
  if (!sp || typeof sp !== 'object') {
    throw new Error('Invalid output: missing spiral.profile object')
  }
  SPIRAL_KEYS.forEach(k => assertScore0to100(sp[k], `spiral.profile.${k}`))
  for (const field of ['dominant_orientation', 'secondary_orientation'] as const) {
    if (!absent(sp[field]) && typeof sp[field] !== 'string') {
      throw new Error(`Invalid output: spiral.profile.${field} must be a string`)
    }
  }
  if (!absent(sp.orientation_evidence)) {
    if (typeof sp.orientation_evidence !== 'object') {
      throw new Error('Invalid output: spiral.profile.orientation_evidence must be an object')
    }
    SPIRAL_KEYS.forEach(k => assertScaleEvidence(sp.orientation_evidence[k], `spiral.profile.orientation_evidence.${k}`))
  }
  for (const field of ['communication_style', 'summary'] as const) {
    if (!absent(sp[field]) && typeof sp[field] !== 'string') {
      throw new Error(`Invalid output: spiral.profile.${field} must be a string`)
    }
  }
  for (const field of ['culture_fit_indicators', 'internal_tags'] as const) {
    if (!absent(sp[field])) assertStringArray(sp[field], `spiral.profile.${field}`)
  }
  assertStringArray(output.spiral.employer_view, 'spiral.employer_view')
  assertOptionalConfidence(output.spiral.confidence, 'spiral.confidence')

  // Confidence
  if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
    throw new Error('Invalid output: confidence must be a number between 0 and 1')
  }
}

// ---------------------------------------------------------------------------

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

    const sent = input.exchanges?.length ? input.exchanges : undefined
    if (!sent && !input.text) {
      throw new TranscriptQualityError('Nothing to analyze: provide exchanges or text')
    }
    // The one rule for "answered" (exchanges.ts) — applied here once; everything below sees only these.
    const answered = sent ? answeredExchanges(sent) : undefined
    if (sent && answered!.length === 0) {
      throw new TranscriptQualityError('Nothing to score: no exchange has an answer.')
    }
    const transcript = answered ? renderExchanges(answered) : (input.text as string)
    const locator = new EvidenceLocator(answered, input.text)

    const quality = assessContentQuality(transcript)
    const { proceed, reason } = shouldProceedWithAnalysis(quality)
    if (!proceed) {
      throw new TranscriptQualityError(reason || 'Transcript quality is insufficient for analysis')
    }

    // Deterministic seed for repeatability: a hash of the transcript
    const transcriptHash = crypto.createHash('md5').update(transcript).digest('hex')
    const seed = parseInt(transcriptHash.substring(0, 8), 16) % 1000000

    const baseMessages = [
      { role: 'system', content: COMBINED_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildCombinedAnalysisPrompt(transcript, { jobRole: input.jobRole ?? input.sitting?.role, interviewType: input.interviewType })
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
      let response
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          seed,
          messages
        })
      } catch (err) {
        throw classifyModelError(err)
      }

      totalTokens += response.usage?.total_tokens || 0
      systemFingerprint = response.system_fingerprint || systemFingerprint

      const content = response.choices[0]?.message?.content
      if (!content) {
        if (attempt < maxAttempts) continue
        throw new ModelUnavailableError('The model answered with no content')
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
        throw new ContractViolationError(
          `The model would not produce a valid assessment after ${maxAttempts} attempts: ${message}`)
      }

      // Soft contract violations: quotes not in a candidate answer + Spiral color labels
      const violations = this.collectSoftViolations(parsed, locator)
      if (violations.length === 0 || attempt >= maxAttempts) {
        raw = parsed
        break
      }
      messages = [...baseMessages, { role: 'user', content: buildCorrectionPrompt(violations) }]
    }

    if (!raw) {
      throw new ContractViolationError('The model produced no valid assessment')
    }

    // Sanitize any violations that survived the retry, score the sheets
    const { frameworks, evidenceDropped, spiralViewScrubbed } = this.toFrameworks(raw, locator)
    const coverage = this.coverage(raw, frameworks, answered, sent?.length ?? 0, transcript)

    return {
      contract: '2',
      sitting: input.sitting,
      coverage,
      frameworks,
      confidence: raw.confidence,
      metadata: {
        model: this.model,
        timestamp: new Date(),
        transcriptLength: transcript.length,
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
    OCEAN_DOMAINS.forEach(d => sites.push({ label: `ocean.domains.${d}`, evidence: raw.ocean.domains?.[d]?.evidence || [] }))
    SDT_KEYS.forEach(k => sites.push({ label: `sdt.scales.${k}`, evidence: raw.sdt.scales?.[k]?.evidence || [] }))
    JDR_KEYS.forEach(k => sites.push({ label: `jdr.scales.${k}`, evidence: raw.jdr.scales?.[k]?.evidence || [] }))
    SPIRAL_KEYS.forEach(k => sites.push({
      label: `spiral.profile.orientation_evidence.${k}`,
      evidence: raw.spiral.profile.orientation_evidence?.[k]?.evidence || []
    }))
    return sites
  }

  private collectSoftViolations(raw: CombinedGPTRawOutput, locator: EvidenceLocator): string[] {
    const violations: string[] = []

    for (const { label, evidence } of this.evidenceSites(raw)) {
      evidence.forEach(quote => {
        if (!locator.locate(quote)) {
          violations.push(`${label} evidence is not a verbatim quote from a candidate answer: "${quote.slice(0, 120)}"`)
        }
      })
    }

    const { violations: spiralViolations } = scrubSpiralEmployerView(raw.spiral.employer_view)
    spiralViolations.forEach(s => {
      violations.push(`spiral.employer_view contains a Spiral color label: "${s.slice(0, 120)}"`)
    })

    return violations
  }

  private toFrameworks(raw: CombinedGPTRawOutput, locator: EvidenceLocator): {
    frameworks: CombinedFrameworks
    evidenceDropped: number
    spiralViewScrubbed: number
  } {
    let evidenceDropped = 0

    // Keep only quotes that really are in a candidate answer (verbatim by construction).
    const verbatim = (quotes: string[] | undefined): EvidenceQuote[] => {
      const kept: EvidenceQuote[] = []
      for (const quote of quotes || []) {
        const q = locator.locate(quote)
        if (q) kept.push(q)
        else evidenceDropped++
      }
      return kept
    }

    const withEvidence = (name: string, score: SheetScaleScore, ev: RawScaleEvidence | undefined): SheetScaleProfile => ({
      ...score,
      name,
      reasoning: ev?.reasoning || '',
      evidence: verbatim(ev?.evidence)
    })

    // OCEAN — score the 120-item sheet: 24 items per domain, 4 per facet
    const oceanScores = scoreOcean(raw.ocean.answers)
    const oceanProfile = {} as Record<OceanDomainKey, OceanDomainProfile>
    OCEAN_DOMAINS.forEach(domain => {
      const ev = raw.ocean.domains?.[domain]
      oceanProfile[domain] = { ...oceanScores[domain], reasoning: ev?.reasoning || '', evidence: verbatim(ev?.evidence) }
    })

    // SDT — score the sheet; dominant drivers are the two highest (computed, never the model's pick)
    const sdtScores = scoreSheet(SDT_ITEMS, raw.sdt.answers)
    const sdtScales = {} as Record<SdtNeedKey, SheetScaleProfile>
    SDT_NEEDS.forEach(n => { sdtScales[n.key] = withEvidence(n.title, sdtScores[n.key], raw.sdt.scales?.[n.key]) })
    const dominantDrivers = [...SDT_KEYS]
      .sort((a, b) => sdtScores[b].average - sdtScores[a].average)
      .slice(0, 2)

    // JD-R — score the sheet
    const jdrScores = scoreSheet(HSE_MSIT_ITEMS, raw.jdr.answers)
    const jdrScales = {} as Record<JdrScaleKey, SheetScaleProfile>
    HSE_MSIT_SCALES.forEach(sc => { jdrScales[sc.key] = withEvidence(sc.title, jdrScores[sc.key], raw.jdr.scales?.[sc.key]) })

    // Spiral — orientations with evidence; dominant/secondary computed; profile stays internal
    const sp = raw.spiral.profile
    const orientations = {} as CombinedFrameworks['spiral']['profile']['orientations']
    SPIRAL_KEYS.forEach(k => {
      const ev = sp.orientation_evidence?.[k]
      orientations[k] = { score: sp[k], reasoning: ev?.reasoning || '', evidence: verbatim(ev?.evidence) }
    })
    const [dominantOrientation, secondaryOrientation] = [...SPIRAL_KEYS].sort((a, b) => sp[b] - sp[a])
    const { clean: spiralView, violations } = scrubSpiralEmployerView(cleanLines(raw.spiral.employer_view))


    const frameworks: CombinedFrameworks = {
      ocean: {
        instrument: 'ipip-neo-120',
        profile: oceanProfile,
        answers: raw.ocean.answers,
        headline: headlineOf(raw.ocean.employer_view),
        employer_view: cleanLines(raw.ocean.employer_view)
      },
      sdt: {
        instrument: 'byall-sdt-needs-v1',
        profile: sdtScales,
        dominant_drivers: dominantDrivers,
        answers: raw.sdt.answers,
        headline: headlineOf(raw.sdt.employer_view),
        employer_view: cleanLines(raw.sdt.employer_view)
      },
      jdr: {
        instrument: 'hse-msit-v1',
        profile: jdrScales,
        sustainability: raw.jdr.sustainability || '',
        answers: raw.jdr.answers,
        headline: headlineOf(raw.jdr.employer_view),
        employer_view: cleanLines(raw.jdr.employer_view)
      },
      spiral: {
        instrument: 'byall-spiral-rubric-v1',
        profile: {
          orientations,
          dominant_orientation: dominantOrientation,
          secondary_orientation: secondaryOrientation,
          communication_style: sp.communication_style || '',
          culture_fit_indicators: sp.culture_fit_indicators || [],
          internal_tags: sp.internal_tags || [],
          summary: sp.summary || ''
        },
        headline: headlineOf(spiralView),
        employer_view: spiralView
      }
    }

    return { frameworks, evidenceDropped, spiralViewScrubbed: violations.length }
  }

  /** How much evidence each framework had. Honest counts, so a report can say "assessed lightly". */
  private coverage(raw: CombinedGPTRawOutput, f: CombinedFrameworks, answered: Exchange[] | undefined, sentCount: number, transcript: string): Coverage {
    // Only exchanges the model actually saw count as targeting a framework.
    const targeted: Record<FrameworkKey, number> = { ocean: 0, sdt: 0, jdr: 0, spiral: 0 }
    for (const e of answered || []) {
      const hit = new Set<FrameworkKey>()
      for (const t of e.themes || []) {
        const fw = THEME_FRAMEWORK[t.toLowerCase()]
        if (fw) hit.add(fw)
      }
      for (const fw of hit) targeted[fw]++
    }
    const quotesIn = (scales: Record<string, { evidence: EvidenceQuote[] }>) =>
      Object.values(scales).reduce((n, s) => n + s.evidence.length, 0)
    const fw = (key: FrameworkKey, quotes: number, neutral: number, conf: number | undefined): FrameworkCoverage => ({
      targeted: targeted[key],
      quotes,
      neutral_items: neutral,
      confidence: conf ?? raw.confidence
    })
    const answeredCount = answered?.length ?? 0
    return {
      exchanges: answeredCount,
      unanswered: Math.max(0, sentCount - answeredCount),
      words: transcript.trim().split(/\s+/).length,
      ocean: fw('ocean', quotesIn(f.ocean.profile), countNeutralAnswers(OCEAN_ITEMS, raw.ocean.answers), raw.ocean.confidence),
      sdt: fw('sdt', quotesIn(f.sdt.profile), countNeutralAnswers(SDT_ITEMS, raw.sdt.answers), raw.sdt.confidence),
      jdr: fw('jdr', quotesIn(f.jdr.profile), countNeutralAnswers(HSE_MSIT_ITEMS, raw.jdr.answers), raw.jdr.confidence),
      spiral: fw('spiral', quotesIn(f.spiral.profile.orientations), 0, raw.spiral.confidence)
    }
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
