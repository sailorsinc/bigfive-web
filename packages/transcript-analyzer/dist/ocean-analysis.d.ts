import type { TranscriptInput, OceanAnalysis } from './types';
import { TranscriptQualityError } from './combined-analyzer';
import type { CombinedAnalysis } from './combined-types';
export { TranscriptQualityError };
/** The old response shape, derived from the combined result. Pure; exported for tests. */
export declare function toOceanAnalysis(combined: CombinedAnalysis): OceanAnalysis;
export declare function analyzeTranscript(input: TranscriptInput, apiKey?: string): Promise<OceanAnalysis>;
