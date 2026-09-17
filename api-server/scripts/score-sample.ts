// Score one sample sitting with the REAL scorer and print a readable result.
//
//   npm run score:sample -- samples/rig-candidate.json
//
// Needs OPENAI_API_KEY. Without it this REFUSES — it never fakes a score.
// (The same rule byall follows: no key, no assessment, say so.)
// Calls the analyzer directly (no HTTP, no Mongo) so it runs anywhere.

import fs from 'fs'
import path from 'path'
import { analyzeCombinedTranscript } from '@bigfive-org/transcript-analyzer'
import { toTranscript } from '../samples/lib'
import type { Sample } from '../samples/lib'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: npm run score:sample -- samples/<name>.json')
    process.exit(2)
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY in the environment — refusing to run. This command scores with the real model or not at all; it never fakes a result.')
    process.exit(2)
  }

  const sample: Sample = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const transcript = toTranscript(sample)
  console.log(`# ${sample.title}  (${sample.id})`)
  console.log(`# exercises: ${sample.exercises}`)
  console.log(`# ${sample.exchanges.length} exchanges · ${transcript.split(/\s+/).length} words\n`)

  const started = Date.now()
  const result = await analyzeCombinedTranscript({ text: transcript, language: sample.language, jobRole: sample.role })
  const f = result.frameworks

  const row = (name: string, s: { average: number; level: string; evidence: string[] }) =>
    console.log(`  ${name.padEnd(18)} ${s.average.toFixed(2).padStart(5)}  ${s.level.padEnd(7)}  ${s.evidence[0] ? `"${s.evidence[0].slice(0, 70)}"` : '(no quote)'}`)

  console.log('Big Five')
  for (const d of ['O', 'C', 'E', 'A', 'N'] as const) row(d, f.ocean.profile[d])
  console.log('SDT')
  for (const k of ['autonomy', 'competence', 'relatedness'] as const) row(k, f.sdt.profile[k])
  console.log(`  dominant: ${f.sdt.profile.dominant_drivers.join(', ')}`)
  console.log('JD-R')
  for (const [k, s] of Object.entries(f.jdr.profile.scales)) row(k, s)
  console.log('Spiral (internal)')
  for (const [k, o] of Object.entries(f.spiral.profile.orientations)) {
    console.log(`  ${k.padEnd(22)} ${String(o.score).padStart(3)}  ${o.evidence[0] ? `"${o.evidence[0].slice(0, 60)}"` : '(no quote)'}`)
  }
  console.log(`  dominant: ${f.spiral.profile.dominant_orientation} · secondary: ${f.spiral.profile.secondary_orientation}`)
  console.log('Employer lines')
  for (const fam of ['ocean', 'sdt', 'jdr', 'spiral'] as const) console.log(`  ${fam}: ${f[fam].employer_view[0] ?? '(none)'}`)
  console.log(`\nconfidence ${result.confidence} · attempts ${result.metadata.attempts} · evidence dropped ${result.metadata.evidenceDropped} · spiral scrubbed ${result.metadata.spiralViewScrubbed} · ${result.metadata.tokensUsed} tokens · ${Date.now() - started} ms`)
}

main().catch(err => { console.error(err); process.exit(1) })
