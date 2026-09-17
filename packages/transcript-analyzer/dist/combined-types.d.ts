import type { SdtNeedKey } from './instruments/sdt-needs';
import type { JdrScaleKey } from './instruments/hse-msit';
import type { OceanDomainKey, OceanFacetScore } from './instruments/ipip-neo-120';
import type { SheetScaleScore, SheetAnswers } from './instruments/score-sheet';
export type { OceanDomainKey };
export type FrameworkKey = 'ocean' | 'sdt' | 'jdr' | 'spiral';
/** One interview exchange — the shape byall holds in memory. */
export interface Exchange {
    n: number;
    question: string;
    answer: string;
    themes?: string[];
}
export interface Sitting {
    id: string;
    language?: string;
    role?: string;
}
/**
 * Input. `exchanges` is the contract-2 path (byall). `text` is the plain-text
 * path kept for the website's /api/analyze, where there is no structure to
 * carry — quotes are then matched against the whole text and carry no exchange.
 */
export interface CombinedTranscriptInput {
    text?: string;
    exchanges?: Exchange[];
    sitting?: Sitting;
    language?: string;
    jobRole?: string;
}
/** A verbatim quote from a candidate answer, and which exchange it came from (absent on the plain-text path). */
export interface EvidenceQuote {
    text: string;
    exchange?: number;
}
/** One scored scale with its evidence trail — the same shape for every framework. */
export interface SheetScaleProfile extends SheetScaleScore {
    name: string;
    reasoning: string;
    evidence: EvidenceQuote[];
}
/** A Big Five domain: a scored scale of 24 items, plus its six facets of 4. */
export interface OceanDomainProfile extends SheetScaleProfile {
    facets: Record<string, OceanFacetScore>;
}
export interface SpiralOrientationProfile {
    score: number;
    reasoning: string;
    evidence: EvidenceQuote[];
}
export type SpiralOrientationKey = 'structure_oriented' | 'achievement_oriented' | 'people_oriented' | 'systems_oriented';
export interface CombinedFrameworks {
    ocean: {
        instrument: 'ipip-neo-120';
        profile: Record<OceanDomainKey, OceanDomainProfile>;
        answers: SheetAnswers;
        headline: string;
        employer_view: string[];
    };
    sdt: {
        instrument: 'byall-sdt-needs-v1';
        profile: Record<SdtNeedKey, SheetScaleProfile>;
        dominant_drivers: SdtNeedKey[];
        answers: SheetAnswers;
        headline: string;
        employer_view: string[];
    };
    jdr: {
        instrument: 'hse-msit-v1';
        profile: Record<JdrScaleKey, SheetScaleProfile>;
        sustainability: string;
        answers: SheetAnswers;
        headline: string;
        employer_view: string[];
    };
    spiral: {
        instrument: 'byall-spiral-rubric-v1';
        profile: {
            orientations: Record<SpiralOrientationKey, SpiralOrientationProfile>;
            dominant_orientation: SpiralOrientationKey;
            secondary_orientation: SpiralOrientationKey;
            communication_style: string;
            culture_fit_indicators: string[];
            internal_tags: string[];
            summary: string;
        };
        headline: string;
        employer_view: string[];
    };
}
/** How much evidence a framework had — so a report can say "assessed lightly". */
export interface FrameworkCoverage {
    targeted: number;
    quotes: number;
    neutral_items: number;
    confidence: number;
}
export interface Coverage {
    exchanges: number;
    words: number;
    ocean: FrameworkCoverage;
    sdt: FrameworkCoverage;
    jdr: FrameworkCoverage;
    spiral: FrameworkCoverage;
}
export interface CombinedAnalysisMetadata {
    model: string;
    timestamp: Date;
    transcriptLength: number;
    tokensUsed: number;
    processingTime: number;
    contentQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    contentQualityScore?: number;
    deterministicSeed?: number;
    systemFingerprint?: string;
    attempts: number;
    evidenceDropped: number;
    spiralViewScrubbed: number;
}
export interface CombinedAnalysis {
    contract: '2';
    sitting?: Sitting;
    coverage: Coverage;
    frameworks: CombinedFrameworks;
    confidence: number;
    metadata: CombinedAnalysisMetadata;
}
/** Reasoning + evidence the model returns per scale, before verbatim filtering. */
export interface RawScaleEvidence {
    reasoning?: string;
    evidence?: string[];
}
export interface CombinedGPTRawOutput {
    ocean: {
        answers: SheetAnswers;
        domains: Record<OceanDomainKey, RawScaleEvidence>;
        employer_view: string[];
        confidence?: number;
    };
    sdt: {
        answers: SheetAnswers;
        scales: Record<SdtNeedKey, RawScaleEvidence>;
        dominant_drivers?: string[];
        employer_view: string[];
        confidence?: number;
    };
    jdr: {
        answers: SheetAnswers;
        scales: Record<JdrScaleKey, RawScaleEvidence>;
        sustainability: string;
        employer_view: string[];
        confidence?: number;
    };
    spiral: {
        profile: {
            structure_oriented: number;
            achievement_oriented: number;
            people_oriented: number;
            systems_oriented: number;
            orientation_evidence?: Partial<Record<SpiralOrientationKey, RawScaleEvidence>>;
            dominant_orientation?: string;
            secondary_orientation?: string;
            communication_style?: string;
            culture_fit_indicators?: string[];
            internal_tags?: string[];
            summary?: string;
        };
        employer_view: string[];
        confidence?: number;
    };
    confidence: number;
}
export interface ChatCompletionsClient {
    chat: {
        completions: {
            create(params: Record<string, unknown>): Promise<{
                choices: Array<{
                    message: {
                        content: string | null;
                    };
                }>;
                usage?: {
                    total_tokens?: number;
                };
                system_fingerprint?: string;
            }>;
        };
    };
}
