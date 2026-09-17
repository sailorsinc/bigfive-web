import type { CombinedTranscriptInput, CombinedAnalysis, CombinedGPTRawOutput, ChatCompletionsClient, Exchange, EvidenceQuote, FrameworkKey } from './combined-types';
export declare const THEME_FRAMEWORK: Record<string, FrameworkKey>;
export declare const SPIRAL_COLOR_PATTERN: RegExp;
/** The transcript fails the content-quality gate. A client error; don't retry. */
export declare class TranscriptQualityError extends Error {
    constructor(message: string);
}
/** The model could not be reached, timed out, rate-limited us, or answered with nothing. Retry later. */
export declare class ModelUnavailableError extends Error {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
/** Our credentials were refused (401/403). A configuration fault — retrying will not help. */
export declare class ModelAuthError extends Error {
    constructor(message: string);
}
/** The account is out of quota (429 insufficient_quota). Needs a human — retrying will not help. */
export declare class ModelQuotaError extends Error {
    constructor(message: string);
}
/** The model rejected THIS request (400/404/413/422 — e.g. context_length_exceeded). Retrying the same request will not help. */
export declare class ModelRejectedRequestError extends Error {
    readonly code?: string;
    constructor(message: string, code?: string);
}
/**
 * Sort a failure from the OpenAI SDK into the four classes above by its HTTP
 * status and error code (duck-typed on the SDK's APIError shape, so a fake
 * client in tests can throw the same shapes). Anything without a status is a
 * connection-level failure -> unavailable.
 */
export declare function classifyModelError(err: unknown): Error;
/** The model answered, but not in the contract, even after one corrective retry. Retry later. */
export declare class ContractViolationError extends Error {
    constructor(message: string);
}
/**
 * Return the exact substring of `haystack` matching `quote`, or null.
 * Accepts whitespace-normalized matches but always returns the haystack's own
 * characters, so the result is verbatim by construction.
 */
export declare function findVerbatimEvidence(haystack: string, quote: string): string | null;
/**
 * Where quotes may come from. With exchanges: each candidate ANSWER, so a
 * phrase that appears only in a question is rejected. Plain text: the whole
 * text, no exchange number.
 */
export declare class EvidenceLocator {
    private readonly sources;
    constructor(exchanges?: Exchange[], text?: string);
    locate(quote: string): EvidenceQuote | null;
}
/** Split employer-view strings into clean vs color-label violations. */
export declare function scrubSpiralEmployerView(view: string[]): {
    clean: string[];
    violations: string[];
};
/** Hard structural validation of the model's JSON. Throws a plain Error naming the first problem. */
export declare function validateCombinedOutput(output: any): asserts output is CombinedGPTRawOutput;
export declare class CombinedAnalyzer {
    private client;
    private model;
    constructor(apiKey: string, options?: {
        client?: ChatCompletionsClient;
        model?: string;
    });
    analyze(input: CombinedTranscriptInput): Promise<CombinedAnalysis>;
    /** Every (label, evidence[]) pair in the raw output — one walk used by both the retry and the sanitizer. */
    private evidenceSites;
    private collectSoftViolations;
    private toFrameworks;
    /** How much evidence each framework had. Honest counts, so a report can say "assessed lightly". */
    private coverage;
}
export declare function analyzeCombinedTranscript(input: CombinedTranscriptInput, apiKey?: string): Promise<CombinedAnalysis>;
