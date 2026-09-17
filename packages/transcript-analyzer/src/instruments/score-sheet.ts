// Generic "sheet" scoring — one arithmetic for every framework: raw 1-5
// answers -> reverse minus-keyed items -> sum and average per scale ->
// cut-offs -> level. Big Five (120 IPIP items), SDT (18) and JD-R (35) all go
// through here, so the four frameworks can never drift apart in arithmetic.
//
// THE CUT-OFFS. average < 2.5 -> low · > 3.5 -> high · else neutral.
// This is the fork's intended calculator (packages/score was edited to these
// values). NOTE the published @bigfive-org/score@1.2.2 default, which the
// bigfive-web WEBSITE uses unchanged, is > 3 / < 3 (neutral only at exactly
// 3.0). The wider neutral band is deliberate for the transcript path, where
// an item with no evidence is answered 3: one stray 4 must not tip a facet to
// "high". Aligning the website is a separate, owner-level decision.

export type Keyed = 'plus' | 'minus'
export type Level = 'low' | 'neutral' | 'high'

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
  percent: number                     // 0-100: (average - 1) / 4 * 100, rounded
  level: Level
}

export type SheetAnswers = Record<string, number>   // item id -> raw 1-5

/** The one set of cut-offs. */
export function calculateResult(score: number, count: number): Level {
  const average = score / count
  if (average > 3.5) return 'high'
  if (average < 2.5) return 'low'
  return 'neutral'
}

/** 1-5 average -> 0-100 (byall's renormalisation, now done here so no caller repeats it). */
export function toPercent(average: number): number {
  return Math.round(((average - 1) / 4) * 100)
}

/** Reverse a raw 1-5 answer for minus-keyed items so that 5 always means "high on the scale". */
export function keyedScore(item: SheetItem, raw: number): number {
  return item.keyed === 'minus' ? 6 - raw : raw
}

/** Hard validation: every item answered, every answer a number 1-5. Throws with the offending item id. */
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

/** Score a sheet: per-scale sum / average / percent / level, scales in the order they first appear in `items`. */
export function scoreSheet<S extends string>(items: SheetItem<S>[], answers: SheetAnswers): Record<S, SheetScaleScore> {
  const out = {} as Record<S, SheetScaleScore>
  for (const item of items) {
    const raw = answers[String(item.id)]
    if (out[item.scale] === undefined) {
      out[item.scale] = { score: 0, count: 0, average: 0, percent: 0, level: 'neutral' }
    }
    const scale = out[item.scale]
    scale.score += keyedScore(item, raw)
    scale.count++
  }
  for (const key of Object.keys(out) as S[]) {
    const scale = out[key]
    scale.average = Math.round((scale.score / scale.count) * 100) / 100
    scale.percent = toPercent(scale.score / scale.count)
    scale.level = calculateResult(scale.score, scale.count)
  }
  return out
}

/** How many items were answered exactly 3 — the "no evidence" answer. Feeds coverage. */
export function countNeutralAnswers(items: SheetItem[], answers: SheetAnswers): number {
  return items.reduce((n, item) => n + (answers[String(item.id)] === 3 ? 1 : 0), 0)
}
