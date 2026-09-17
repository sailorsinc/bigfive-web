import type { Exchange } from './combined-types';
export declare function isAnswered(e: Exchange): boolean;
export declare function answeredExchanges(exchanges: Exchange[] | undefined): Exchange[];
/** Trim and drop blank lines — the normalised employer_view for every framework. */
export declare function cleanLines(view: string[] | undefined): string[];
/** The one employer-safe sentence to show: the first non-blank line, trimmed. */
export declare function headlineOf(view: string[] | undefined): string;
