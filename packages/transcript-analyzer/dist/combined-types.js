"use strict";
// Types for the combined four-framework assessment (OCEAN + SDT + JD-R + Spiral).
// ADDITIVE module — nothing here touches the existing OCEAN-only analyzer types.
//
// V1 "sheets": SDT and JD-R are no longer a single 0-100 gut number per
// dimension. The model answers an item pool AS THE CANDIDATE (18 SDT items,
// 35 HSE MSIT items), and the server scores it with the same sum -> average
// -> cut-off arithmetic as the OCEAN facets. Every scale carries reasoning
// and verbatim transcript evidence, checked like OCEAN's.
Object.defineProperty(exports, "__esModule", { value: true });
