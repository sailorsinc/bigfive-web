import type { SdtNeedKey } from './instruments/sdt-needs';
import type { JdrScaleKey } from './instruments/hse-msit';
import type { SheetScaleScore, SheetAnswers } from './instruments/score-sheet';
export interface CombinedTranscriptInput {
    text: string;
    language?: string;
    candidateName?: string;
    jobRole?: string;
}
export interface OceanDomainProfile {
    score: number;
    average: number;
    level: 'low' | 'neutral' | 'high';
    reasoning: string;
    evidence: string[];
}
export type OceanDomainKey = 'O' | 'C' | 'E' | 'A' | 'N';
/** One scored scale of a sheet, with its evidence trail (the OCEAN domain shape, generalised). */
export interface SheetScaleProfile extends SheetScaleScore {
    reasoning: string;
    evidence: string[];
}
export interface SpiralOrientationProfile {
    score: number;
    reasoning: string;
    evidence: string[];
}
export type SpiralOrientationKey = 'structure_oriented' | 'achievement_oriented' | 'people_oriented' | 'systems_oriented';
export interface CombinedFrameworks {
    ocean: {
        profile: Record<OceanDomainKey, OceanDomainProfile>;
        employer_view: string[];
    };
    sdt: {
        profile: Record<SdtNeedKey, SheetScaleProfile> & {
            dominant_drivers: SdtNeedKey[];
            answers: SheetAnswers;
            instrument: 'byall-sdt-needs-v1';
        };
        employer_view: string[];
    };
    jdr: {
        profile: {
            scales: Record<JdrScaleKey, SheetScaleProfile>;
            sustainability: string;
            answers: SheetAnswers;
            instrument: 'hse-msit-v1';
        };
        employer_view: string[];
    };
    spiral: {
        profile: {
            orientations: Record<SpiralOrientationKey, SpiralOrientationProfile>;
            dominant_orientation: SpiralOrientationKey;
            secondary_orientation: SpiralOrientationKey;
            communication_style: string;
            culture_fit_indicators: string[];
            internal_tags: string[];
            summary: string;
            instrument: 'byall-spiral-rubric-v1';
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
        domains: Record<string, {
            facets: Record<string, number>;
            reasoning: string;
            evidence: string[];
        }>;
        employer_view: string[];
    };
    sdt: {
        answers: SheetAnswers;
        scales: Record<SdtNeedKey, RawScaleEvidence>;
        dominant_drivers: string[];
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
            dominant_orientation: string;
            secondary_orientation: string;
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
