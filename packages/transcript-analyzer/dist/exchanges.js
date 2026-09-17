"use strict";
// The ONE rule for "what counts as an answered exchange", used by the prompt
// renderer, the evidence locator, the analyzer's gate, coverage, and the API
// route's stored counts. A blank or whitespace-only answer is not an answer.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnswered = isAnswered;
exports.answeredExchanges = answeredExchanges;
exports.cleanLines = cleanLines;
exports.headlineOf = headlineOf;
function isAnswered(e) {
    return typeof e.answer === 'string' && e.answer.trim().length > 0;
}
function answeredExchanges(exchanges) {
    return (exchanges || []).filter(isAnswered);
}
/** Trim and drop blank lines — the normalised employer_view for every framework. */
function cleanLines(view) {
    return (view || []).map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0);
}
/** The one employer-safe sentence to show: the first non-blank line, trimmed. */
function headlineOf(view) {
    return cleanLines(view)[0] ?? '';
}
