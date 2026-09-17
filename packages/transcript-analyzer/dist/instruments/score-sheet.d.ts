export type Keyed = 'plus' | 'minus';
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
    level: 'low' | 'neutral' | 'high';
}
export type SheetAnswers = Record<string, number>;
/** Reverse a raw 1-5 answer for minus-keyed items so that 5 always means "high on the scale". */
export declare function keyedScore(item: SheetItem, raw: number): number;
/** Hard validation: every item answered, every answer an integer-ish 1-5. Throws with the offending item id. */
export declare function validateSheetAnswers(items: SheetItem[], answers: unknown, label: string): asserts answers is SheetAnswers;
/** Score a sheet: per-scale sum / average / level, in the order the scales first appear in `items`. */
export declare function scoreSheet<S extends string>(items: SheetItem<S>[], answers: SheetAnswers): Record<S, SheetScaleScore>;
