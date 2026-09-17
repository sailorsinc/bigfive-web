export declare const COMBINED_SYSTEM_PROMPT: string;
export declare function buildCombinedAnalysisPrompt(transcript: string, context?: {
    candidateName?: string;
    jobRole?: string;
}): string;
export declare function buildCorrectionPrompt(violations: string[]): string;
