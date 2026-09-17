import type { SdtNeedKey } from './instruments/sdt-needs';
import type { JdrScaleKey } from './instruments/hse-msit';
import type { OceanDomainKey, OceanFacetScore } from './instruments/ipip-neo-120';
import type { SheetScaleScore, SheetAnswers } from './instruments/score-sheet';
export type { OceanDomainKey };
export interface CombinedTranscriptInput {
    text: string;
    language?: string;
    candidateName?: string;
    jobRole?: string;
}
/** One scored scale with its evidence trail — the same shape for every framework. */
export interface SheetScaleProfile extends SheetScaleScore {
    name: string;
    reasoning: string;
    evidence: string[];
}
/** A Big Five domain: a scored scale of 24 items, plus its six facets of 4. */
export interface OceanDomainProfile extends SheetScaleProfile {
    facets: Record<string, OceanFacetScore>;
}
export interface SpiralOrientationProfile {
    score: number;
    reasoning: string;
    evidence: string[];
}
export type SpiralOrientationKey = 'structure_oriented' | 'achievement_oriented' | 'people_oriented' | 'systems_oriented';
export interface CombinedFrameworks {
    ocean: {
        instrument: 'ipip-neo-120';
        profile: Record<OceanDomainKey, OceanDomainProfile>;
        answers: SheetAnswers;
        employer_view: string[];
    };
    sdt: {
        instrument: 'byall-sdt-needs-v1';
        profile: Record<SdtNeedKey, SheetScaleProfile>;
        dominant_drivers: SdtNeedKey[];
        answers: SheetAnswers;
        employer_view: string[];
    };
    jdr: {
        instrument: 'hse-msit-v1';
        profile: Record<JdrScaleKey, SheetScaleProfile>;
        sustainability: string;
        answers: SheetAnswers;
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
        employer_view: string[];
    };
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
    };
    sdt: {
        answers: SheetAnswers;
        scales: Record<SdtNeedKey, RawScaleEvidence>;
        dominant_drivers?: string[];
        employer_view: string[];
    };
    jdr: {
        answers: SheetAnswers;
        scales: Record<JdrScaleKey, RawScaleEvidence>;
        sustainability: string;
        employer_view: string[];
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
