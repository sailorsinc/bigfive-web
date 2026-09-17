// The Big Five-only shape consumed by the bigfive-web website and /api/analyze.
// Produced by ocean-analysis.ts as a view over the combined analyzer (D4).

import type { CombinedAnalysisMetadata } from './combined-types'

export interface TranscriptInput {
  text: string
  language?: string
  interviewType?: 'behavioral' | 'technical' | 'mixed'
  duration?: number
  jobRole?: string
}

export interface FacetScore {
  score: number      // sum of the facet's 4 keyed answers (4-20)
  count: number      // 4
  result: 'low' | 'neutral' | 'high'
}

export interface DomainScore {
  score: number      // sum of the domain's 24 keyed answers (24-120)
  count: number      // 24
  result: 'low' | 'neutral' | 'high'
  facet: Record<string, FacetScore>
}

export type Scores = Record<string, DomainScore>

/** One of the 120 answers, keyed — the shape the website stores for a human sitting. */
export interface StoredAnswer {
  domain: 'O' | 'C' | 'E' | 'A' | 'N'
  facet: number
  score: number      // 1-5, keyed (5 = high on the trait)
}

export interface Evidence {
  domain: 'O' | 'C' | 'E' | 'A' | 'N'
  facet: number      // 0 — evidence is per domain
  facetName: string  // the domain name
  quote: string
  reasoning: string
  confidence: number
}

export type AnalysisMetadata = CombinedAnalysisMetadata

export interface OceanAnalysis {
  scores: Scores
  answers: StoredAnswer[]
  evidence: Evidence[]
  confidence: number
  reasoning: string
  metadata: AnalysisMetadata
}
