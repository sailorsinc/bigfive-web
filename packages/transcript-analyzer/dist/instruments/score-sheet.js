"use strict";
// Generic "sheet" scoring — the @bigfive-org/score arithmetic applied to any
// keyed item pool: raw 1-5 answers -> reverse minus-keyed items -> sum and
// average per scale -> the shared calculateResult cut-offs (<2.5 low,
// >3.5 high, else neutral). One scorer for SDT and JD-R so the two sheets
// can never drift apart in arithmetic.
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyedScore = keyedScore;
exports.validateSheetAnswers = validateSheetAnswers;
exports.scoreSheet = scoreSheet;
const transformer_1 = require("../transformer");
/** Reverse a raw 1-5 answer for minus-keyed items so that 5 always means "high on the scale". */
function keyedScore(item, raw) {
    return item.keyed === 'minus' ? 6 - raw : raw;
}
/** Hard validation: every item answered, every answer an integer-ish 1-5. Throws with the offending item id. */
function validateSheetAnswers(items, answers, label) {
    if (!answers || typeof answers !== 'object') {
        throw new Error(`Invalid output: ${label}.answers must be an object of item -> 1-5`);
    }
    for (const item of items) {
        const raw = answers[String(item.id)];
        if (typeof raw !== 'number' || raw < 1 || raw > 5) {
            throw new Error(`Invalid output: ${label}.answers["${item.id}"] must be a number 1-5, got ${raw}`);
        }
    }
}
/** Score a sheet: per-scale sum / average / level, in the order the scales first appear in `items`. */
function scoreSheet(items, answers) {
    const out = {};
    for (const item of items) {
        const raw = answers[String(item.id)];
        if (out[item.scale] === undefined) {
            out[item.scale] = { score: 0, count: 0, average: 0, level: 'neutral' };
        }
        const scale = out[item.scale];
        scale.score += keyedScore(item, raw);
        scale.count++;
    }
    for (const key of Object.keys(out)) {
        const scale = out[key];
        scale.average = Math.round((scale.score / scale.count) * 100) / 100;
        scale.level = (0, transformer_1.calculateResult)(scale.score, scale.count);
    }
    return out;
}
