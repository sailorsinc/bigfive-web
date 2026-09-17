"use strict";
// Types for the combined four-framework assessment (OCEAN + SDT + JD-R + Spiral).
//
// Everything is a sheet (design D2). The model answers an item pool AS THE
// CANDIDATE — 120 IPIP-NEO items for Big Five, 18 for SDT, 35 HSE MSIT items
// for JD-R — and the server scores it with one arithmetic (instruments/
// score-sheet.ts). Spiral has no open instrument: four judged 0-100 numbers,
// validated, labelled as byall's own rubric.
//
// Shape (contract 2, v1 names kept): for the three sheet frameworks `profile`
// is exactly the map of scales; `instrument`, `answers`, `employer_view` and
// the framework-specific extras sit beside it. Spiral's `profile` keeps its
// v1 meaning — internal-only, never shown to an employer.
Object.defineProperty(exports, "__esModule", { value: true });
