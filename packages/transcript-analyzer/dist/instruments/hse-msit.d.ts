import type { SheetItem, Keyed } from './score-sheet';
export type JdrScaleKey = 'demands' | 'control' | 'manager_support' | 'peer_support' | 'relationships' | 'role' | 'change';
export interface InstrumentItem extends SheetItem<JdrScaleKey> {
    id: number;
    text: string;
    keyed: Keyed;
    response: 'frequency' | 'agreement';
}
export interface InstrumentScale {
    key: JdrScaleKey;
    title: string;
    high: string;
    low: string;
    family: 'demand' | 'resource';
}
export declare const HSE_MSIT_SCALES: InstrumentScale[];
export declare const HSE_MSIT_ITEMS: InstrumentItem[];
export declare const HSE_MSIT_ITEM_IDS: string[];
