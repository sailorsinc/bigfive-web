import type { TranscriptInput, OceanAnalysis } from './types';
export declare class TranscriptAnalyzer {
    private openai;
    constructor(apiKey: string);
    analyze(input: TranscriptInput): Promise<OceanAnalysis>;
    private validateGPTOutput;
}
export declare function analyzeTranscript(input: TranscriptInput, apiKey?: string): Promise<OceanAnalysis>;
