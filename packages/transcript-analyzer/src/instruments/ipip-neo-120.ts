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

import { getItems } from '@bigfive-org/questions'
import getTemplate from '@bigfive-org/results/lib/get-template'
import type { SheetItem, SheetAnswers, SheetScaleScore } from './score-sheet'
import { scoreSheet } from './score-sheet'

export type OceanDomainKey = 'O' | 'C' | 'E' | 'A' | 'N'
export const OCEAN_DOMAINS: OceanDomainKey[] = ['O', 'C', 'E', 'A', 'N']

export interface OceanItem extends SheetItem<OceanDomainKey> {
  id: number            // the questionnaire's own item number (1-120)
  facet: number         // 1-6 within the domain
}

interface TemplateDomain {
  domain: string
  title: string
  facets: Array<{ facet: number; title: string }>
}

const TEMPLATE: TemplateDomain[] = getTemplate('en')

export const OCEAN_ITEMS: OceanItem[] = getItems('en').map(q => ({
  id: q.num,
  text: q.text,
  scale: q.domain as OceanDomainKey,
  facet: q.facet,
  keyed: q.keyed === 'minus' ? 'minus' : 'plus'
}))

export const OCEAN_ITEM_IDS = OCEAN_ITEMS.map(i => String(i.id))

/** Human names from the results template — the same names the website prints. */
export function domainName(domain: OceanDomainKey): string {
  return TEMPLATE.find(d => d.domain === domain)?.title ?? domain
}

export function facetName(domain: OceanDomainKey, facet: number): string {
  return TEMPLATE.find(d => d.domain === domain)?.facets.find(f => f.facet === facet)?.title ?? `Facet ${facet}`
}

export interface OceanFacetScore extends SheetScaleScore {
  name: string
}

export interface OceanDomainScore extends SheetScaleScore {
  name: string
  facets: Record<string, OceanFacetScore>   // '1'..'6'
}

/**
 * Score 120 raw answers: per domain (24 items) and per facet (4 items),
 * both through the one sheet scorer. Reversal of minus-keyed items, sums,
 * averages and cut-offs are all scoreSheet's — nothing Big Five-specific here.
 */
export function scoreOcean(answers: SheetAnswers): Record<OceanDomainKey, OceanDomainScore> {
  const byDomain = scoreSheet(OCEAN_ITEMS, answers)
  const facetItems = OCEAN_ITEMS.map(i => ({ ...i, scale: `${i.scale}${i.facet}` }))
  const byFacet = scoreSheet(facetItems, answers)

  const out = {} as Record<OceanDomainKey, OceanDomainScore>
  for (const domain of OCEAN_DOMAINS) {
    const facets: Record<string, OceanFacetScore> = {}
    for (let f = 1; f <= 6; f++) {
      facets[String(f)] = { ...byFacet[`${domain}${f}`], name: facetName(domain, f) }
    }
    out[domain] = { ...byDomain[domain], name: domainName(domain), facets }
  }
  return out
}
