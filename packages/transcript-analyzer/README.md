# @bigfive-org/transcript-analyzer

Scores an interview across four frameworks — Big Five (OCEAN), Self-Determination
Theory (SDT), Job Demands-Resources (JD-R) and Spiral Dynamics — in one model call.

**The model is a stand-in respondent, never a judge.** For Big Five, SDT and JD-R it
fills in a fixed item sheet *as the candidate* from what they said in the interview,
and this package does the arithmetic (`instruments/score-sheet.ts`: reverse
minus-keyed items → sum → average → `low` < 2.5 / `neutral` / `high` > 3.5). Every
scale carries reasoning and quotes that are verbatim from a candidate answer.

| Framework | Sheet | Source |
|---|---|---|
| OCEAN | 120 Johnson IPIP-NEO items → 5 domains × 6 facets | `@bigfive-org/questions` (public domain); names from `@bigfive-org/results` |
| SDT | 18 items → autonomy, competence, relatedness | `instruments/sdt-needs.ts` — byall's own wording on the W-BNS structure (the W-BNS items are research-only licensed and are not reproduced) |
| JD-R | 35 items → 7 scales | `instruments/hse-msit.ts` — the UK HSE Management Standards Indicator Tool (Crown copyright, Open Government Licence) |
| Spiral | 4 orientations 0-100, judged | no open validated instrument exists; validated and labelled as byall's own rubric; internal-only |

## Usage — the combined assessment (contract 2)

```typescript
import { analyzeCombinedTranscript } from '@bigfive-org/transcript-analyzer'

const result = await analyzeCombinedTranscript({
  sitting: { id: 'sit_8f3a2c', language: 'en', role: 'Backend engineer' },   // never a name
  exchanges: [
    { n: 1, question: "Tell me about a problem you'd never seen before…", answer: '…', themes: ['openness'] },
    // … one per interview exchange
  ]
})

result.frameworks.ocean.profile.O            // { name, score, count: 24, average, percent, level, reasoning, evidence, facets }
result.frameworks.ocean.profile.O.evidence   // [{ text: '…verbatim from an answer…', exchange: 1 }]
result.frameworks.jdr.profile.demands        // same shape, 7 scales
result.frameworks.sdt.dominant_drivers       // the two highest needs — computed
result.frameworks.spiral.profile             // internal-only; employer_view/headline are colour-word free
result.coverage.sdt                          // { targeted, quotes, neutral_items, confidence }
```

A plain `text` may be passed instead of `exchanges` (the website's path); quotes are
then matched against the whole text and carry no `exchange`.

Errors are typed: `TranscriptQualityError` (too short — a client error),
`ModelUnavailableError` (retry later), `ContractViolationError` (the model would not
produce a valid sheet after one corrective retry).

## Usage — the Big Five-only view

`analyzeTranscript` is a view over the same analyzer in the shape the bigfive-web
website has always consumed:

```typescript
import { analyzeTranscript } from '@bigfive-org/transcript-analyzer'

const analysis = await analyzeTranscript({ text: 'Interviewer: …\nCandidate: …', language: 'en' })

analysis.scores.O        // { score, count: 24, result, facet: { '1': { score, count: 4, result }, … } }
analysis.answers         // the 120 keyed answers, as a human sitting is stored
analysis.evidence        // per domain: { domain, facet: 0, facetName, quote, reasoning, confidence }
```

## Determinism and quotes

Temperature 0.1, JSON-only output, and a seed derived from the transcript, so the same
interview scores the same way. Every quote is checked character-for-character against
the candidate's answers; the model is retried once on a violation and leftovers are
dropped and counted (`metadata.evidenceDropped`).

## Environment

```bash
export OPENAI_API_KEY=sk-...
# optional
export OPENAI_MODEL=gpt-4o
```

## Tests

```bash
npm run build && npm test
```

## License

MIT for this package. Instrument licences as in the table above.
