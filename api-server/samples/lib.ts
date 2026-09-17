// Sample sittings: the shape byall holds in memory (question / answer / themes
// per exchange), and the two ways it can reach the scorer.
//
//   toWireV1(sample)  — what byall sends TODAY: one flattened transcript string
//                       (byall_v2/interview.py transcript_text, copied exactly)
//                       plus metadata.themes as a parallel list.
//   toWireV2(sample)  — the structured request (design D6): exchanges + sitting.
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

/** byall's transcript_text(): "Interviewer: q\nCandidate: a" per answered exchange, joined by newlines. */
export function toTranscript(sample: Sample): string {
  return sample.exchanges
    .filter(e => e.answer)
    .map(e => `Interviewer: ${e.question}\nCandidate: ${e.answer}`)
    .join('\n')
}

/** The request byall's scorer sends today (byall_v2/scorer.py _score_external). */
export function toWireV1(sample: Sample): { transcript: string; metadata: { source: string; themes: string[][] } } {
  return {
    transcript: toTranscript(sample),
    metadata: {
      source: 'byall_v2',
      themes: sample.exchanges.filter(e => e.answer).map(e => [...e.themes])
    }
  }
}

/** The structured request (design D6). Accepted by the scorer from phase 5 on. */
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
