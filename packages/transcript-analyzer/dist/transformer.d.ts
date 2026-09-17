import type { Scores, GPTRawOutput, Evidence } from './types';
export { calculateResult } from './instruments/score-sheet';
export declare function transformToScoreFormat(gptOutput: GPTRawOutput): Scores;
export declare function enrichEvidence(rawEvidence: GPTRawOutput['evidence']): Evidence[];
