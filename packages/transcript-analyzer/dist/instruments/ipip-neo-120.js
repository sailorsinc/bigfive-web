"use strict";
// Johnson's IPIP-NEO-120 — the Big Five "sheet".
//
// The 120 items, their domain/facet and their keying come from the published
// @bigfive-org/questions package (the same items the bigfive-web website has
// run on for years; public domain). Domain and facet NAMES come from
// @bigfive-org/results' template. Nothing about the instrument is typed here —
// this file only adapts those packages to the generic sheet scorer.
//
// In the transcript path the model answers all 120 items AS THE CANDIDATE
// (raw 1-5 on the Very Inaccurate … Very Accurate scale, never reversed),
// answering 3 where the interview gives no evidence. Scoring is the same
// arithmetic the website applies to a human's answers.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCEAN_ITEM_IDS = exports.OCEAN_ITEMS = exports.OCEAN_DOMAINS = void 0;
exports.domainName = domainName;
exports.facetName = facetName;
exports.scoreOcean = scoreOcean;
const questions_1 = require("@bigfive-org/questions");
const get_template_1 = __importDefault(require("@bigfive-org/results/lib/get-template"));
const score_sheet_1 = require("./score-sheet");
exports.OCEAN_DOMAINS = ['O', 'C', 'E', 'A', 'N'];
const TEMPLATE = (0, get_template_1.default)('en');
exports.OCEAN_ITEMS = (0, questions_1.getItems)('en').map(q => ({
    id: q.num,
    text: q.text,
    scale: q.domain,
    facet: q.facet,
    keyed: q.keyed === 'minus' ? 'minus' : 'plus'
}));
exports.OCEAN_ITEM_IDS = exports.OCEAN_ITEMS.map(i => String(i.id));
/** Human names from the results template — the same names the website prints. */
function domainName(domain) {
    return TEMPLATE.find(d => d.domain === domain)?.title ?? domain;
}
function facetName(domain, facet) {
    return TEMPLATE.find(d => d.domain === domain)?.facets.find(f => f.facet === facet)?.title ?? `Facet ${facet}`;
}
/**
 * Score 120 raw answers: per domain (24 items) and per facet (4 items),
 * both through the one sheet scorer. Reversal of minus-keyed items, sums,
 * averages and cut-offs are all scoreSheet's — nothing Big Five-specific here.
 */
function scoreOcean(answers) {
    const byDomain = (0, score_sheet_1.scoreSheet)(exports.OCEAN_ITEMS, answers);
    const facetItems = exports.OCEAN_ITEMS.map(i => ({ ...i, scale: `${i.scale}${i.facet}` }));
    const byFacet = (0, score_sheet_1.scoreSheet)(facetItems, answers);
    const out = {};
    for (const domain of exports.OCEAN_DOMAINS) {
        const facets = {};
        for (let f = 1; f <= 6; f++) {
            facets[String(f)] = { ...byFacet[`${domain}${f}`], name: facetName(domain, f) };
        }
        out[domain] = { ...byDomain[domain], name: domainName(domain), facets };
    }
    return out;
}
