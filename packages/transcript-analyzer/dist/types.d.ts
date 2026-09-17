import type { CombinedAnalysisMetadata } from './combined-types';
export interface TranscriptInput {
    text: string;
    language?: string;
    interviewType?: 'behavioral' | 'technical' | 'mixed';
    duration?: number;
    jobRole?: string;
}
export interface FacetScore {
    score: number;
    count: number;
    result: 'low' | 'neutral' | 'high';
}
export interface DomainScore {
    score: number;
    count: number;
    result: 'low' | 'neutral' | 'high';
    facet: Record<string, FacetScore>;
}
export type Scores = Record<string, DomainScore>;
/** One of the 120 answers, keyed — the shape the website stores for a human sitting. */
export interface StoredAnswer {
    domain: 'O' | 'C' | 'E' | 'A' | 'N';
    facet: number;
    score: number;
}
export interface Evidence {
    domain: 'O' | 'C' | 'E' | 'A' | 'N';
    facet: number;
    facetName: string;
    quote: string;
    reasoning: string;
    confidence: number;
}
export type AnalysisMetadata = CombinedAnalysisMetadata;
export interface OceanAnalysis {
    scores: Scores;
    answers: StoredAnswer[];
    evidence: Evidence[];
    confidence: number;
    reasoning: string;
    metadata: AnalysisMetadata;
}
