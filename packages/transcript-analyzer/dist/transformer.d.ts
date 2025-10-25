import type { Scores, GPTRawOutput, Evidence } from './types';
export declare function calculateResult(score: number, count: number): 'low' | 'neutral' | 'high';
export declare function transformToScoreFormat(gptOutput: GPTRawOutput): Scores;
export declare function enrichEvidence(rawEvidence: GPTRawOutput['evidence']): Evidence[];
