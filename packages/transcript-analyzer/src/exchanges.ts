// The ONE rule for "what counts as an answered exchange", used by the prompt
// renderer, the evidence locator, the analyzer's gate, coverage, and the API
// route's stored counts. A blank or whitespace-only answer is not an answer.

import type { Exchange } from './combined-types'

export function isAnswered(e: Exchange): boolean {
  return typeof e.answer === 'string' && e.answer.trim().length > 0
}

export function answeredExchanges(exchanges: Exchange[] | undefined): Exchange[] {
  return (exchanges || []).filter(isAnswered)
}

/** Trim and drop blank lines — the normalised employer_view for every framework. */
export function cleanLines(view: string[] | undefined): string[] {
  return (view || []).map(s => (typeof s === 'string' ? s.trim() : '')).filter(s => s.length > 0)
}

/** The one employer-safe sentence to show: the first non-blank line, trimmed. */
export function headlineOf(view: string[] | undefined): string {
  return cleanLines(view)[0] ?? ''
}
