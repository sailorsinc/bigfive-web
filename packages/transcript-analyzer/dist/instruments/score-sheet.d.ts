export type Keyed = 'plus' | 'minus';
export type Level = 'low' | 'neutral' | 'high';
export interface SheetItem<S extends string = string> {
    id: number | string;
    text: string;
    scale: S;
    keyed: Keyed;
}
export interface SheetScaleScore {
    score: number;
    count: number;
    average: number;
    percent: number;
    level: Level;
}
export type SheetAnswers = Record<string, number>;
/** The one set of cut-offs. */
export declare function calculateResult(score: number, count: number): Level;
/** 1-5 average -> 0-100 (byall's renormalisation, now done here so no caller repeats it). */
export declare function toPercent(average: number): number;
/** Reverse a raw 1-5 answer for minus-keyed items so that 5 always means "high on the scale". */
export declare function keyedScore(item: SheetItem, raw: number): number;
/** Hard validation: every item answered, every answer a number 1-5. Throws with the offending item id. */
export declare function validateSheetAnswers(items: SheetItem[], answers: unknown, label: string): asserts answers is SheetAnswers;
/** Score a sheet: per-scale sum / average / percent / level, scales in the order they first appear in `items`. */
export declare function scoreSheet<S extends string>(items: SheetItem<S>[], answers: SheetAnswers): Record<S, SheetScaleScore>;
/** How many items were answered exactly 3 — the "no evidence" answer. Feeds coverage. */
export declare function countNeutralAnswers(items: SheetItem[], answers: SheetAnswers): number;
