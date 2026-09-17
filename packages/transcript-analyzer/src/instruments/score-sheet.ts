// Generic "sheet" scoring — the @bigfive-org/score arithmetic applied to any
// keyed item pool: raw 1-5 answers -> reverse minus-keyed items -> sum and
// average per scale -> the shared calculateResult cut-offs (<2.5 low,
// >3.5 high, else neutral). One scorer for SDT and JD-R so the two sheets
// can never drift apart in arithmetic.

import { calculateResult } from '../transformer'

export type Keyed = 'plus' | 'minus'

export interface SheetItem<S extends string = string> {
  id: number | string
  text: string
  scale: S
  keyed: Keyed
}

export interface SheetScaleScore {
  score: number                       // sum of keyed item scores
  count: number                       // items in the scale
  average: number                     // 1-5, two decimals
  level: 'low' | 'neutral' | 'high'
}

export type SheetAnswers = Record<string, number>   // item id -> raw 1-5

/** Reverse a raw 1-5 answer for minus-keyed items so that 5 always means "high on the scale". */
export function keyedScore(item: SheetItem, raw: number): number {
  return item.keyed === 'minus' ? 6 - raw : raw
}

/** Hard validation: every item answered, every answer an integer-ish 1-5. Throws with the offending item id. */
export function validateSheetAnswers(items: SheetItem[], answers: unknown, label: string): asserts answers is SheetAnswers {
  if (!answers || typeof answers !== 'object') {
    throw new Error(`Invalid output: ${label}.answers must be an object of item -> 1-5`)
  }
  for (const item of items) {
    const raw = (answers as Record<string, unknown>)[String(item.id)]
    if (typeof raw !== 'number' || raw < 1 || raw > 5) {
      throw new Error(`Invalid output: ${label}.answers["${item.id}"] must be a number 1-5, got ${raw}`)
    }
  }
}

/** Score a sheet: per-scale sum / average / level, in the order the scales first appear in `items`. */
export function scoreSheet<S extends string>(items: SheetItem<S>[], answers: SheetAnswers): Record<S, SheetScaleScore> {
  const out = {} as Record<S, SheetScaleScore>
  for (const item of items) {
    const raw = answers[String(item.id)]
    if (out[item.scale] === undefined) {
      out[item.scale] = { score: 0, count: 0, average: 0, level: 'neutral' }
    }
    const scale = out[item.scale]
    scale.score += keyedScore(item, raw)
    scale.count++
  }
  for (const key of Object.keys(out) as S[]) {
    const scale = out[key]
    scale.average = Math.round((scale.score / scale.count) * 100) / 100
    scale.level = calculateResult(scale.score, scale.count)
  }
  return out
}
