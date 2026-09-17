"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateResult = void 0;
exports.transformToScoreFormat = transformToScoreFormat;
exports.enrichEvidence = enrichEvidence;
const ocean_assessment_1 = require("./prompts/ocean-assessment");
// The one calculator lives in instruments/score-sheet.ts; re-exported here only
// until the OCEAN-only analyzer is retired (design phase 4).
var score_sheet_1 = require("./instruments/score-sheet");
Object.defineProperty(exports, "calculateResult", { enumerable: true, get: function () { return score_sheet_1.calculateResult; } });
const score_sheet_2 = require("./instruments/score-sheet");
function transformToScoreFormat(gptOutput) {
    const result = {};
    const domains = ['O', 'C', 'E', 'A', 'N'];
    domains.forEach(domain => {
        const facets = gptOutput.scores[domain].facets;
        // Calculate domain score (sum of all facets)
        let domainScore = 0;
        const facetScores = {};
        Object.entries(facets).forEach(([facetNum, score]) => {
            domainScore += score;
            facetScores[facetNum] = {
                score: score,
                count: 1,
                result: (0, score_sheet_2.calculateResult)(score, 1)
            };
        });
        result[domain] = {
            score: domainScore,
            count: 6, // Always 6 facets per domain
            result: (0, score_sheet_2.calculateResult)(domainScore, 6),
            facet: facetScores
        };
    });
    return result;
}
function enrichEvidence(rawEvidence) {
    return rawEvidence.map(ev => ({
        domain: ev.domain,
        facet: ev.facet,
        facetName: ocean_assessment_1.FACET_NAMES[ev.domain]?.[ev.facet.toString()] || `Facet ${ev.facet}`,
        quote: ev.quote,
        reasoning: ev.reasoning,
        confidence: ev.confidence
    }));
}
