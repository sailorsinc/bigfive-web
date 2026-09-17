# Sample sittings

Hand-written interviews in the shape byall holds in memory — eight exchanges,
one per theme, each with the real first-door question from byall's
`QUESTION_BANK` (`byall_v2/interview.py`) and a written answer.

**They are samples.** Real content, written to exercise specific behaviour,
never passed off as real candidates. They are not a generator and they are
not mock output: the only thing that ever produces a score is the real scorer.

| Sample | Exercises |
|---|---|
| `rig-candidate` | byall's own five scripted answers (`testing/eval/sut.py`) + three for the new themes. The baseline; the tripwire test runs on it. |
| `thin-answers` | One-line answers. Honest neutrals and low coverage, never invented detail. |
| `wrong-speaker-trap` | Every question has a quotable phrase the answer never repeats. A quote containing one is provably from the interviewer. |
| `high-demands-low-support` | Overloaded, unsupported, competent. The JD-R sheet should show it. |
| `autonomy-driven` | SDT: autonomy dominant, relatedness low. |
| `relatedness-driven` | SDT: relatedness dominant, autonomy unimportant. Paired with the one above. |

## Using them

- **Tests** turn a sample into byall's current wire format with `toWireV1()`
  (`lib.ts` — the exact `transcript_text()` flattening) so the format under
  test is the real one. `toWireV2()` is the structured request from design
  phase 5.
- **Eyeballing real results:** `npm run score:sample -- samples/<name>.json`
  scores a sample with the real model and prints a readable summary. It
  needs `OPENAI_API_KEY` and refuses without one — it never fakes a score.

## Adding one

Copy any file, change `id`, `title`, `exercises`, and the eight answers. Keep
the questions as byall asks them. Say in `exercises` what the sample is for —
a sample with no purpose is noise.
