import type { Scores, GPTRawOutput, Evidence } from './types'
import { FACET_NAMES } from './prompts/ocean-assessment'

export function calculateResult(score: number, count: number): 'low' | 'neutral' | 'high' {
  const avgScore = score / count
  if (avgScore > 3.5) return 'high'
  if (avgScore < 2.5) return 'low'
  return 'neutral'
}

export function transformToScoreFormat(gptOutput: GPTRawOutput): Scores {
  const result: Scores = {}

  const domains = ['O', 'C', 'E', 'A', 'N'] as const

  domains.forEach(domain => {
    const facets = gptOutput.scores[domain].facets

    // Calculate domain score (sum of all facets)
    let domainScore = 0
    const facetScores: Record<string, any> = {}

    Object.entries(facets).forEach(([facetNum, score]) => {
      domainScore += score as number
      facetScores[facetNum] = {
        score: score,
        count: 1,
        result: calculateResult(score as number, 1)
      }
    })

    result[domain] = {
      score: domainScore,
      count: 6, // Always 6 facets per domain
      result: calculateResult(domainScore, 6),
      facet: facetScores
    }
  })

  return result
}

export function enrichEvidence(rawEvidence: GPTRawOutput['evidence']): Evidence[] {
  return rawEvidence.map(ev => ({
    domain: ev.domain as 'O' | 'C' | 'E' | 'A' | 'N',
    facet: ev.facet,
    facetName: FACET_NAMES[ev.domain]?.[ev.facet.toString()] || `Facet ${ev.facet}`,
    quote: ev.quote,
    reasoning: ev.reasoning,
    confidence: ev.confidence
  }))
}
