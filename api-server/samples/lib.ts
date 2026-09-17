// Sample sittings: the shape byall holds in memory (question / answer / themes
// per exchange), and how one reaches the scorer.
//
//   toWireV2(sample)   — the contract-2 request: exchanges + sitting.
//   toTranscript(sample) — the plain "Interviewer: / Candidate:" text, for the
//                        website-style /api/analyze path and word counts.
//
// The samples themselves are hand-written interviews under ./*.json. They are
// SAMPLES — real content, labelled as such — never passed off as real candidates.

export interface SampleExchange {
  n: number
  question: string
  answer: string
  themes: string[]
}

export interface Sample {
  id: string
  title: string
  // What this sample is for — the behaviour it exists to exercise.
  exercises: string
  language: string
  role?: string
  exchanges: SampleExchange[]
}

/** The plain-text rendering ("Interviewer: q\nCandidate: a" per answered exchange). */
export function toTranscript(sample: Sample): string {
  return sample.exchanges
    .filter(e => e.answer)
    .map(e => `Interviewer: ${e.question}\nCandidate: ${e.answer}`)
    .join('\n')
}

/** The contract-2 request. */
export function toWireV2(sample: Sample): {
  contract: '2'
  sitting: { id: string; language: string; role?: string }
  exchanges: SampleExchange[]
} {
  return {
    contract: '2',
    sitting: { id: `sample-${sample.id}`, language: sample.language, role: sample.role },
    exchanges: sample.exchanges.map(e => ({ ...e, themes: [...e.themes] }))
  }
}
