// Types for the combined four-framework assessment (OCEAN + SDT + JD-R + Spiral).
//
// Everything is a sheet (design D2). The model answers an item pool AS THE
// CANDIDATE — 120 IPIP-NEO items for Big Five, 18 for SDT, 35 HSE MSIT items
// for JD-R — and the server scores it with one arithmetic (instruments/
// score-sheet.ts). Spiral has no open instrument: four judged 0-100 numbers,
// validated, labelled as byall's own rubric.
//
// Contract 2 (v1 names, v2 shapes — design D6): the input is the interview as
// structured EXCHANGES; every quote is drawn from a candidate ANSWER and tagged
// with its exchange; every framework carries a headline and coverage. For the
// three sheet frameworks `profile` is exactly the map of scales; `instrument`,
// `answers`, `headline`, `employer_view` and the extras sit beside it. Spiral's
// `profile` keeps its v1 meaning — internal-only, never shown to an employer.

import type { SdtNeedKey } from './instruments/sdt-needs'
import type { JdrScaleKey } from './instruments/hse-msit'
import type { OceanDomainKey, OceanFacetScore } from './instruments/ipip-neo-120'
import type { SheetScaleScore, SheetAnswers } from './instruments/score-sheet'

export type { OceanDomainKey }

export type FrameworkKey = 'ocean' | 'sdt' | 'jdr' | 'spiral'

/** One interview exchange — the shape byall holds in memory. */
export interface Exchange {
  n: number
  question: string
  answer: string
  themes?: string[]
}

export interface Sitting {
  id: string
  language?: string
  role?: string
}

/**
 * Input. `exchanges` is the contract-2 path (byall). `text` is the plain-text
 * path kept for the website's /api/analyze, where there is no structure to
 * carry — quotes are then matched against the whole text and carry no exchange.
 */
export interface CombinedTranscriptInput {
  text?: string
  exchanges?: Exchange[]
  sitting?: Sitting
  language?: string
  jobRole?: string
}

/** A verbatim quote from a candidate answer, and which exchange it came from (absent on the plain-text path). */
export interface EvidenceQuote {
  text: string
  exchange?: number
}

/** One scored scale with its evidence trail — the same shape for every framework. */
export interface SheetScaleProfile extends SheetScaleScore {
  name: string
  reasoning: string
  evidence: EvidenceQuote[]
}

/** A Big Five domain: a scored scale of 24 items, plus its six facets of 4. */
export interface OceanDomainProfile extends SheetScaleProfile {
  facets: Record<string, OceanFacetScore>   // '1'..'6'
}

export interface SpiralOrientationProfile {
  score: number // 0-100
  reasoning: string
  evidence: EvidenceQuote[]
}

export type SpiralOrientationKey =
  | 'structure_oriented'
  | 'achievement_oriented'
  | 'people_oriented'
  | 'systems_oriented'

export interface CombinedFrameworks {
  ocean: {
    instrument: 'ipip-neo-120'
    profile: Record<OceanDomainKey, OceanDomainProfile>
    answers: SheetAnswers          // the 120 raw answers, auditable and re-scorable
    headline: string               // the one employer-safe sentence to show (= employer_view[0])
    employer_view: string[]
  }
  sdt: {
    // Honest label: the structure is W-BNS-shaped, the items are byall's own.
    instrument: 'byall-sdt-needs-v1'
    profile: Record<SdtNeedKey, SheetScaleProfile>
    dominant_drivers: SdtNeedKey[]  // the two highest — computed, never the model's pick
    answers: SheetAnswers
    headline: string
    employer_view: string[]
  }
  jdr: {
    instrument: 'hse-msit-v1'
    profile: Record<JdrScaleKey, SheetScaleProfile>
    sustainability: string
    answers: SheetAnswers
    headline: string
    employer_view: string[]
  }
  spiral: {
    // Honest label: no open validated Spiral instrument exists; this is byall's rubric.
    instrument: 'byall-spiral-rubric-v1'
    // INTERNAL-ONLY — vMEME orientation data lives here and only here.
    profile: {
      orientations: Record<SpiralOrientationKey, SpiralOrientationProfile>
      dominant_orientation: SpiralOrientationKey   // computed
      secondary_orientation: SpiralOrientationKey  // computed
      communication_style: string
      culture_fit_indicators: string[]
      internal_tags: string[]
      summary: string
    }
    headline: string
    // Neutral-language strings ONLY — no vMEME color labels. Enforced post-hoc.
    employer_view: string[]
  }
}

/** How much evidence a framework had — so a report can say "assessed lightly". */
export interface FrameworkCoverage {
  targeted: number       // exchanges whose themes aimed at this framework
  quotes: number         // verbatim quotes that survived the check
  neutral_items: number  // sheet items answered 3 (no evidence); 0 for Spiral
  confidence: number     // the model's confidence for this framework, 0-1
}

export interface Coverage {
  exchanges: number
  words: number
  ocean: FrameworkCoverage
  sdt: FrameworkCoverage
  jdr: FrameworkCoverage
  spiral: FrameworkCoverage
}

export interface CombinedAnalysisMetadata {
  model: string
  timestamp: Date
  transcriptLength: number
  tokensUsed: number
  processingTime: number
  contentQuality?: 'poor' | 'fair' | 'good' | 'excellent'
  contentQualityScore?: number
  deterministicSeed?: number
  systemFingerprint?: string
  attempts: number
  evidenceDropped: number
  spiralViewScrubbed: number
}

export interface CombinedAnalysis {
  contract: '2'
  sitting?: Sitting
  coverage: Coverage
  frameworks: CombinedFrameworks
  confidence: number
  metadata: CombinedAnalysisMetadata
}

/** Reasoning + evidence the model returns per scale, before verbatim filtering. */
export interface RawScaleEvidence {
  reasoning?: string
  evidence?: string[]
}

// Raw shape we ask GPT for (before server-side scoring and sanitization)
export interface CombinedGPTRawOutput {
  ocean: {
    answers: SheetAnswers                              // '1'..'120' each 1-5
    domains: Record<OceanDomainKey, RawScaleEvidence>
    employer_view: string[]
    confidence?: number
  }
  sdt: {
    answers: SheetAnswers                              // '1'..'18' each 1-5
    scales: Record<SdtNeedKey, RawScaleEvidence>
    dominant_drivers?: string[]                        // ignored — computed server-side
    employer_view: string[]
    confidence?: number
  }
  jdr: {
    answers: SheetAnswers                              // '1'..'35' each 1-5
    scales: Record<JdrScaleKey, RawScaleEvidence>
    sustainability: string
    employer_view: string[]
    confidence?: number
  }
  spiral: {
    profile: {
      structure_oriented: number
      achievement_oriented: number
      people_oriented: number
      systems_oriented: number
      orientation_evidence?: Partial<Record<SpiralOrientationKey, RawScaleEvidence>>
      dominant_orientation?: string                    // ignored — computed server-side
      secondary_orientation?: string
      communication_style?: string
      culture_fit_indicators?: string[]
      internal_tags?: string[]
      summary?: string
    }
    employer_view: string[]
    confidence?: number
  }
  confidence: number
}

// Minimal client interface so tests can inject a fake OpenAI client.
export interface ChatCompletionsClient {
  chat: {
    completions: {
      create(params: Record<string, unknown>): Promise<{
        choices: Array<{ message: { content: string | null } }>
        usage?: { total_tokens?: number }
        system_fingerprint?: string
      }>
    }
  }
}
