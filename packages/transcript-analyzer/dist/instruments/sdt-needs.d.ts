import type { SheetItem, Keyed } from './score-sheet';
export type SdtNeedKey = 'autonomy' | 'competence' | 'relatedness';
export interface SdtNeed {
    key: SdtNeedKey;
    title: string;
    about: string;
    high: string;
    low: string;
}
export declare const SDT_NEEDS: SdtNeed[];
export interface SdtItem extends SheetItem<SdtNeedKey> {
    id: number;
    keyed: Keyed;
}
export declare const SDT_ITEMS: SdtItem[];
export declare const SDT_ITEM_IDS: string[];
