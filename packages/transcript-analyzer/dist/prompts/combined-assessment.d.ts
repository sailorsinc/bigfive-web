import type { Exchange } from '../combined-types';
/**
 * The interview as the model reads it. Same "Interviewer: / Candidate:" lines
 * byall's transcript_text() produced, plus each exchange's number and themes as
 * a hint line — quotes are still matched against the candidate ANSWERS only.
 */
export declare function renderExchanges(exchanges: Exchange[]): string;
export declare const COMBINED_SYSTEM_PROMPT: string;
export declare function buildCombinedAnalysisPrompt(transcript: string, context?: {
    jobRole?: string;
    interviewType?: string;
}): string;
export declare function buildCorrectionPrompt(violations: string[]): string;
