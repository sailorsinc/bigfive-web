"use strict";
// The Big Five-only view — ONE Big Five (design D4).
//
// `analyzeTranscript` used to be a second, older implementation: its own
// prompt (30 facet ratings, quotes never checked), no retry, no tests, a 500
// for a short transcript. It is now a thin view over the combined analyzer:
// the same 120-item IPIP sheet, the same quote checks, the same calculator —
// re-expressed in the `OceanAnalysis` shape the bigfive-web website and
// /api/analyze have always consumed.
//
// What changed for those consumers, and why it is better:
//   scores[d]          count is 24 (was 6) — the domain really is 24 items now
//   scores[d].facet[n] score is the 4-item sum, count 4 (was a single 1-5 rating
//                      with count 1: the "always 1" workaround)
//   answers            NEW — the 120 keyed answers, exactly what the website
//                      stores for a human sitting, so its result page computes
//                      the same domains from the same data
//   evidence           per DOMAIN now (the sheet has no per-facet quotes);
//                      facetName carries the domain name, facet is 0
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptQualityError = void 0;
exports.toOceanAnalysis = toOceanAnalysis;
exports.analyzeTranscript = analyzeTranscript;
const combined_analyzer_1 = require("./combined-analyzer");
Object.defineProperty(exports, "TranscriptQualityError", { enumerable: true, get: function () { return combined_analyzer_1.TranscriptQualityError; } });
const ipip_neo_120_1 = require("./instruments/ipip-neo-120");
const score_sheet_1 = require("./instruments/score-sheet");
/** The old response shape, derived from the combined result. Pure; exported for tests. */
function toOceanAnalysis(combined) {
    const ocean = combined.frameworks.ocean;
    const scores = {};
    const evidence = [];
    const reasoning = [];
    for (const domain of ipip_neo_120_1.OCEAN_DOMAINS) {
        const p = ocean.profile[domain];
        const facet = {};
        for (const [n, f] of Object.entries(p.facets)) {
            facet[n] = { score: f.score, count: f.count, result: f.level };
        }
        scores[domain] = { score: p.score, count: p.count, result: p.level, facet };
        for (const quote of p.evidence) {
            evidence.push({
                domain,
                facet: 0,
                facetName: (0, ipip_neo_120_1.domainName)(domain),
                quote,
                reasoning: p.reasoning,
                confidence: combined.confidence
            });
        }
        if (p.reasoning)
            reasoning.push(`${(0, ipip_neo_120_1.domainName)(domain)}: ${p.reasoning}`);
    }
    // The 120 answers as the website stores a human's: keyed, so 5 always means "high".
    const answers = ipip_neo_120_1.OCEAN_ITEMS.map(item => ({
        domain: item.scale,
        facet: item.facet,
        score: (0, score_sheet_1.keyedScore)(item, ocean.answers[String(item.id)])
    }));
    return {
        scores,
        answers,
        evidence,
        confidence: combined.confidence,
        reasoning: reasoning.join('\n'),
        metadata: combined.metadata
    };
}
async function analyzeTranscript(input, apiKey) {
    const combined = await (0, combined_analyzer_1.analyzeCombinedTranscript)({ text: input.text, language: input.language, candidateName: input.candidateName, jobRole: input.jobRole }, apiKey);
    return toOceanAnalysis(combined);
}
