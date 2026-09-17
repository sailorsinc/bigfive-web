// THE TRIPWIRE — contract 2 (design phase 5; rewritten from the v1 tripwire
// on 17 Sep 2026, the one phase allowed to change what byall reads).
//
// Pins exactly what byall's contract-2 scorer (byall-redesign phase 6) reads
// from POST /api/analyze-combined:
//
//   contract                                      '2'
//   id                                            string
//   sitting.id                                    echoed
//   confidence                                    number 0..1
//   coverage.{ocean,sdt,jdr,spiral}               {targeted, quotes, neutral_items, confidence}
//   frameworks.ocean.profile[O|C|E|A|N].average   number 1..5
//   frameworks.ocean.profile[..].percent          integer 0..100
//   frameworks.ocean.profile[..].level            'low' | 'neutral' | 'high'
//   frameworks.ocean.profile[..].evidence[]       [{text, exchange}] — text verbatim in THAT exchange's answer
//   frameworks.{sdt,jdr}.profile[scale]           same fields as above
//   frameworks.*.headline                         non-empty string
//   frameworks.*.employer_view                    string[], no colour words
//
// It also RECORDS the full response for the rig sample to
// samples/recorded/rig-candidate.contract2.json — the fixture byall's phase-6
// brief builds against, and a snapshot: any drift in the shape shows up as a
// git diff of that file. Volatile fields (meta.ms) are zeroed first.
//
// The request is the real contract-2 wire shape (samples/lib toWireV2).
// Run: npm test (from api-server/). No network, no Mongo.

import http from 'http'
import assert from 'assert'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { startOpenAIStub, stubDb } from './helpers/stub-openai'
import { toWireV2 } from '../samples/lib'
import type { Sample } from '../samples/lib'
import { OCEAN_ITEMS } from '@bigfive-org/transcript-analyzer'

stubDb()

const LEVELS = ['low', 'neutral', 'high']
const FAMILIES = ['ocean', 'sdt', 'jdr', 'spiral'] as const
const COLOUR = /\b(blue|orange|green|yellow|turquoise|red|purple|beige)\b/i

function loadSample(name: string): Sample {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', `${name}.json`), 'utf8'))
}

// A canned model answer whose quotes are all real substrings of the sample's answers.
function cannedFor(sample: Sample) {
  const answers = sample.exchanges.map(e => e.answer)
  const q = (i: number, from: number, len: number) => answers[i].split(' ').slice(from, from + len).join(' ')
  const oceanAnswers: Record<string, number> = {}
  for (const item of OCEAN_ITEMS) oceanAnswers[String(item.id)] = item.keyed === 'minus' ? 2 : 4
  const ev = (quote: string) => ({ reasoning: 'Stated directly.', evidence: [quote] })
  const sdtAnswers: Record<string, number> = {}
  for (let i = 1; i <= 18; i++) sdtAnswers[String(i)] = i <= 6 ? 4 : 3
  const jdrAnswers: Record<string, number> = {}
  for (let i = 1; i <= 35; i++) jdrAnswers[String(i)] = 3
  return {
    ocean: {
      answers: oceanAnswers,
      domains: { O: ev(q(0, 0, 6)), C: ev(q(1, 0, 6)), E: ev(q(2, 0, 6)), A: ev(q(3, 0, 6)), N: ev(q(4, 0, 6)) },
      employer_view: ['Thinks a problem through before acting', 'Keeps commitments visible', 'Steady under pressure'],
      confidence: 0.82
    },
    sdt: {
      answers: sdtAnswers,
      scales: { autonomy: ev(q(5, 0, 5)), competence: ev(q(5, 6, 5)), relatedness: ev(q(2, 0, 5)) },
      employer_view: ['Motivated by getting properly good at the work', 'Works well with room to decide', 'Values a team that talks'],
      confidence: 0.55
    },
    jdr: {
      answers: jdrAnswers,
      scales: {
        demands: ev(q(4, 0, 5)), control: ev(q(1, 0, 5)), manager_support: ev(q(6, 0, 5)), peer_support: ev(q(2, 0, 5)),
        relationships: ev(q(3, 0, 5)), role: ev(q(1, 6, 5)), change: ev(q(0, 0, 5))
      },
      sustainability: 'Sustainable with variety and a team to think with.',
      employer_view: ['Gets energy from working problems through with others', 'Long meeting blocks wear them down', 'Handles deadline pressure by working the list'],
      confidence: 0.6
    },
    spiral: {
      profile: {
        structure_oriented: 55, achievement_oriented: 60, people_oriented: 65, systems_oriented: 50,
        orientation_evidence: { structure_oriented: ev(q(1, 0, 5)), achievement_oriented: ev(q(0, 0, 5)), people_oriented: ev(q(3, 0, 5)), systems_oriented: ev(q(7, 0, 5)) },
        communication_style: 'Direct, with room for everyone to weigh in',
        culture_fit_indicators: ['collaborative teams with clear goals'],
        internal_tags: ['green_primary', 'orange_secondary'],
        summary: 'Collaborative and results-minded.'
      },
      employer_view: ['Relationship-oriented with a results streak', 'Prefers clear goals with room to decide how', 'Adapts to the people in the room'],
      confidence: 0.58
    },
    confidence: 0.74
  }
}

function assertScale(label: string, s: any, sample: Sample) {
  assert.ok(typeof s.average === 'number' && s.average >= 1 && s.average <= 5, `${label}.average in 1..5`)
  assert.ok(Number.isInteger(s.percent) && s.percent >= 0 && s.percent <= 100, `${label}.percent integer 0..100`)
  assert.ok(LEVELS.includes(s.level), `${label}.level must be one of ${LEVELS}`)
  assert.equal(typeof s.name, 'string')
  assert.ok(Array.isArray(s.evidence), `${label}.evidence must be an array`)
  for (const e of s.evidence) {
    assert.equal(typeof e.text, 'string')
    assert.ok(Number.isInteger(e.exchange) && e.exchange >= 1, `${label} evidence must name its exchange`)
    const answer = sample.exchanges.find(x => x.n === e.exchange)?.answer ?? ''
    assert.ok(answer.includes(e.text), `${label} quote must be verbatim in exchange ${e.exchange}'s ANSWER: "${e.text}"`)
  }
}

async function main() {
  const openai = await startOpenAIStub()
  const { analyzeCombinedRouter } = require('../src/routes/analyze-combined')
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/api/analyze-combined', analyzeCombinedRouter)
  const server = http.createServer(app)
  const port = await new Promise<number>(resolve => { server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)) })

  const sample = loadSample('rig-candidate')
  const wire = toWireV2(sample)
  assert.equal(wire.contract, '2')
  assert.equal(wire.exchanges.length, sample.exchanges.length)

  openai.setCanned(cannedFor(sample))
  const res = await fetch(`http://127.0.0.1:${port}/api/analyze-combined`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(wire)
  })
  assert.equal(res.status, 200, 'byall expects 200 on a good sitting')
  const body: any = await res.json()

  // --- what byall reads, line by line ---------------------------------------
  assert.equal(body.contract, '2')
  assert.equal(typeof body.id, 'string')
  assert.equal(body.sitting.id, wire.sitting.id)
  assert.ok(typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1)

  for (const fam of FAMILIES) {
    const c = body.coverage?.[fam]
    assert.ok(c, `coverage.${fam} must exist`)
    for (const k of ['targeted', 'quotes', 'neutral_items']) assert.ok(Number.isInteger(c[k]) && c[k] >= 0, `coverage.${fam}.${k}`)
    assert.ok(typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1, `coverage.${fam}.confidence`)
  }

  const ocean = body.frameworks?.ocean?.profile
  assert.ok(ocean && typeof ocean === 'object', 'frameworks.ocean.profile must exist')
  for (const letter of ['O', 'C', 'E', 'A', 'N']) {
    assert.ok(ocean[letter], `ocean.profile.${letter} must exist`)
    assertScale(`ocean.${letter}`, ocean[letter], sample)
  }
  for (const k of ['autonomy', 'competence', 'relatedness']) assertScale(`sdt.${k}`, body.frameworks.sdt.profile[k], sample)
  for (const k of ['demands', 'control', 'manager_support', 'peer_support', 'relationships', 'role', 'change']) {
    assertScale(`jdr.${k}`, body.frameworks.jdr.profile[k], sample)
  }

  for (const fam of FAMILIES) {
    const fw = body.frameworks?.[fam]
    assert.ok(typeof fw.headline === 'string' && fw.headline.length > 0, `${fam}.headline must be a non-empty string`)
    const view = fw.employer_view
    assert.ok(Array.isArray(view) && view.every((s: unknown) => typeof s === 'string'), `${fam}.employer_view must be a string array`)
    assert.ok(view.length > 0, `${fam}.employer_view must not be empty`)
    assert.equal(fw.headline, view[0], `${fam}.headline is the first employer line`)
    for (const s of view) assert.ok(!COLOUR.test(s), `no colour word in ${fam}.employer_view: ${s}`)
  }
  console.log('PASS byall-compat (contract 2): everything byall reads is present, typed and in range')

  // --- record the response as the fixture byall's phase 6 builds against -------
  const recorded = JSON.parse(JSON.stringify(body))
  recorded.meta.ms = 0
  const outDir = path.join(__dirname, '..', 'samples', 'recorded')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'rig-candidate.contract2.json')
  fs.writeFileSync(outFile, JSON.stringify({
    _note: 'Recorded by test/byall-compat.test.ts: the real route + real scoring arithmetic, driven by a canned model answer for samples/rig-candidate.json. The fixture byall\'s contract-2 scorer is built against; a change in shape shows up as a diff here.',
    request: wire,
    response: recorded
  }, null, 2) + '\n')
  console.log(`recorded ${path.relative(process.cwd(), outFile)}`)

  server.close()
  openai.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
