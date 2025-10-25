export interface TranscriptInput {
  text: string
  language?: string
  interviewType?: 'behavioral' | 'technical' | 'mixed'
  duration?: number
  candidateName?: string
  jobRole?: string
}

export interface FacetScore {
  score: number      // 1-5 scale
  count: number      // Always 1
  result: 'low' | 'neutral' | 'high'
}

export interface DomainScore {
  score: number      // Sum of 6 facets (6-30)
  count: number      // Always 6
  result: 'low' | 'neutral' | 'high'
  facet: Record<string, FacetScore>
}

export type Scores = Record<string, DomainScore>

export interface Evidence {
  domain: 'O' | 'C' | 'E' | 'A' | 'N'
  facet: number
  facetName: string
  quote: string
  reasoning: string
  confidence: number
}

export interface AnalysisMetadata {
  model: string
  timestamp: Date
  transcriptLength: number
  tokensUsed: number
  processingTime: number
  contentQuality?: 'poor' | 'fair' | 'good' | 'excellent'
  contentQualityScore?: number
  deterministicSeed?: number
  systemFingerprint?: string
}

export interface OceanAnalysis {
  scores: Scores
  evidence: Evidence[]
  confidence: number
  reasoning: string
  metadata: AnalysisMetadata
}

export interface GPTRawOutput {
  scores: {
    O: { facets: Record<string, number> }
    C: { facets: Record<string, number> }
    E: { facets: Record<string, number> }
    A: { facets: Record<string, number> }
    N: { facets: Record<string, number> }
  }
  evidence: Array<{
    domain: string
    facet: number
    quote: string
    reasoning: string
    confidence: number
  }>
  confidence: number
  reasoning: string
}
