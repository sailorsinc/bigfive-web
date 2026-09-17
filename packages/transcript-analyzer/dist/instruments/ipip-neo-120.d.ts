import type { SheetItem, SheetAnswers, SheetScaleScore } from './score-sheet';
export type OceanDomainKey = 'O' | 'C' | 'E' | 'A' | 'N';
export declare const OCEAN_DOMAINS: OceanDomainKey[];
export interface OceanItem extends SheetItem<OceanDomainKey> {
    id: number;
    facet: number;
}
export declare const OCEAN_ITEMS: OceanItem[];
export declare const OCEAN_ITEM_IDS: string[];
/** Human names from the results template — the same names the website prints. */
export declare function domainName(domain: OceanDomainKey): string;
export declare function facetName(domain: OceanDomainKey, facet: number): string;
export interface OceanFacetScore extends SheetScaleScore {
    name: string;
}
export interface OceanDomainScore extends SheetScaleScore {
    name: string;
    facets: Record<string, OceanFacetScore>;
}
/**
 * Score 120 raw answers: per domain (24 items) and per facet (4 items),
 * both through the one sheet scorer. Reversal of minus-keyed items, sums,
 * averages and cut-offs are all scoreSheet's — nothing Big Five-specific here.
 */
export declare function scoreOcean(answers: SheetAnswers): Record<OceanDomainKey, OceanDomainScore>;
