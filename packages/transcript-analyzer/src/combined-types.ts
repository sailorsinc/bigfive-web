// Types for the combined four-framework assessment (OCEAN + SDT + JD-R + Spiral).
// ADDITIVE module — nothing here touches the existing OCEAN-only analyzer types.
//
// V1 "sheets": SDT and JD-R are no longer a single 0-100 gut number per
// dimension. The model answers an item pool AS THE CANDIDATE (18 SDT items,
// 35 HSE MSIT items), and the server scores it with the same sum -> average
// -> cut-off arithmetic as the OCEAN facets. Every scale carries reasoning
// and verbatim transcript evidence, checked like OCEAN's.

import type { SdtNeedKey } from './instruments/sdt-needs'
import type { JdrScaleKey } from './instruments/hse-msit'
import type { SheetScaleScore, SheetAnswers } from './instruments/score-sheet'

export interface CombinedTranscriptInput {
  text: string
  language?: string
  candidateName?: string
  jobRole?: string
}

export interface OceanDomainProfile {
  score: number // 6-30 (sum of six 1-5 facet scores)
  average: number // 1-5
  level: 'low' | 'neutral' | 'high'
  reasoning: string
  evidence: string[] // verbatim transcript substrings
}

export type OceanDomainKey = 'O' | 'C' | 'E' | 'A' | 'N'

/** One scored scale of a sheet, with its evidence trail (the OCEAN domain shape, generalised). */
export interface SheetScaleProfile extends SheetScaleScore {
  reasoning: string
  evidence: string[] // verbatim transcript substrings
}

export interface SpiralOrientationProfile {
  score: number // 0-100
  reasoning: string
  evidence: string[]
}

export type SpiralOrientationKey =
  | 'structure_oriented'
  | 'achievement_oriented'
  | 'people_oriented'
  | 'systems_oriented'

export interface CombinedFrameworks {
  ocean: {
    profile: Record<OceanDomainKey, OceanDomainProfile>
    employer_view: string[]
  }
  sdt: {
    profile: Record<SdtNeedKey, SheetScaleProfile> & {
      dominant_drivers: SdtNeedKey[]
      // The raw sheet, kept so the result is auditable and re-scorable.
      answers: SheetAnswers
      // Honest label: the structure is W-BNS-shaped, the items are byall's own.
      instrument: 'byall-sdt-needs-v1'
    }
    employer_view: string[]
  }
  jdr: {
    profile: {
      // Seven HSE scales — the JD-R result, the same shape as OCEAN's five
      // domains. (The pre-sheet "demands"/"resources" 0-100 pair is gone: it
      // was read by nothing.)
      scales: Record<JdrScaleKey, SheetScaleProfile>
      sustainability: string
      answers: SheetAnswers
      instrument: 'hse-msit-v1'
    }
    employer_view: string[]
  }
  spiral: {
    // INTERNAL-ONLY profile — vMEME orientation data lives here and only here.
    profile: {
      orientations: Record<SpiralOrientationKey, SpiralOrientationProfile>
      dominant_orientation: SpiralOrientationKey
      secondary_orientation: SpiralOrientationKey
      communication_style: string
      culture_fit_indicators: string[]
      internal_tags: string[]
      summary: string
      // Honest label: no open validated Spiral instrument exists; this is byall's rubric.
      instrument: 'byall-spiral-rubric-v1'
    }
    // Neutral-language strings ONLY — no vMEME color labels. Enforced post-hoc.
    employer_view: string[]
  }
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
  frameworks: CombinedFrameworks
  confidence: number
  metadata: CombinedAnalysisMetadata
}

/** Reasoning + evidence the model returns per scale, before verbatim filtering. */
export interface RawScaleEvidence {
  reasoning?: string
  evidence?: string[]
}

// Raw shape we ask GPT for (before server-side transform/sanitization)
export interface CombinedGPTRawOutput {
  ocean: {
    domains: Record<string, {
      facets: Record<string, number> // '1'..'6' each 1-5
      reasoning: string
      evidence: string[]
    }>
    employer_view: string[]
  }
  sdt: {
    answers: SheetAnswers                              // '1'..'18' each 1-5
    scales: Record<SdtNeedKey, RawScaleEvidence>
    dominant_drivers: string[]
    employer_view: string[]
  }
  jdr: {
    answers: SheetAnswers                              // '1'..'35' each 1-5
    scales: Record<JdrScaleKey, RawScaleEvidence>
    sustainability: string
    employer_view: string[]
  }
  spiral: {
    profile: {
      structure_oriented: number
      achievement_oriented: number
      people_oriented: number
      systems_oriented: number
      orientation_evidence?: Partial<Record<SpiralOrientationKey, RawScaleEvidence>>
      dominant_orientation: string
      secondary_orientation: string
      communication_style?: string
      culture_fit_indicators?: string[]
      internal_tags?: string[]
      summary?: string
    }
    employer_view: string[]
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
