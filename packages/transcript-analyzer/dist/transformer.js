"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateResult = calculateResult;
exports.transformToScoreFormat = transformToScoreFormat;
exports.enrichEvidence = enrichEvidence;
const ocean_assessment_1 = require("./prompts/ocean-assessment");
function calculateResult(score, count) {
    const avgScore = score / count;
    if (avgScore > 3.5)
        return 'high';
    if (avgScore < 2.5)
        return 'low';
    return 'neutral';
}
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
                result: calculateResult(score, 1)
            };
        });
        result[domain] = {
            score: domainScore,
            count: 6, // Always 6 facets per domain
            result: calculateResult(domainScore, 6),
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
