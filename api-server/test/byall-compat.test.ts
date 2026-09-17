// THE TRIPWIRE (design phase 0).
//
// Pins exactly what byall reads from POST /api/analyze-combined today
// (byall-redesign byall_v2/scorer.py ExternalScorer._score_external and
// _fork_frameworks / _employer_views, checked 2026-09-17):
//
//   frameworks.ocean.profile[O|C|E|A|N].average   number 1..5
//   frameworks.ocean.profile[..].level            'low' | 'neutral' | 'high'
//   frameworks.ocean.profile[..].evidence[]       verbatim substrings of the transcript
//   frameworks.{ocean,sdt,jdr,spiral}.employer_view  string[]
//   confidence                                    number 0..1
//   id                                            string
//
// Every later phase must keep this green. A phase that needs to change one of
// these lines must say so in the plan, out loud. The request is built from a
// sample sitting through the SAME flattening byall does (samples/lib toWireV1),
// so the wire format under test is the real one.
//
// Run: npm test (from api-server/). No network, no Mongo.

import http from 'http'
import assert from 'assert'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { startOpenAIStub, stubDb } from './helpers/stub-openai'
import { toWireV1, toTranscript } from '../samples/lib'
import type { Sample } from '../samples/lib'
import { OCEAN_ITEMS } from '@bigfive-org/transcript-analyzer'

stubDb()

const BYALL_LEVELS = ['low', 'neutral', 'high']       // byall's _FORK_LEVEL keys
const FAMILIES = ['ocean', 'sdt', 'jdr', 'spiral']     // byall's _employer_views loop

function loadSample(name: string): Sample {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', `${name}.json`), 'utf8'))
}

// A canned model answer whose quotes are all real substrings of the sample's answers.
function cannedFor(sample: Sample) {
  const answers = sample.exchanges.map(e => e.answer)
  const q = (i: number, from: number, len: number) => answers[i].split(' ').slice(from, from + len).join(' ')
  const oceanAnswers: Record<string, number> = {}
  for (const item of OCEAN_ITEMS) oceanAnswers[String(item.id)] = 3
  const domain = (quote: string) => ({ reasoning: 'Stated across several answers.', evidence: [quote] })
  const ev = (quote: string) => ({ reasoning: 'Stated directly.', evidence: [quote] })
  const sdtAnswers: Record<string, number> = {}
  for (let i = 1; i <= 18; i++) sdtAnswers[String(i)] = 3
  const jdrAnswers: Record<string, number> = {}
  for (let i = 1; i <= 35; i++) jdrAnswers[String(i)] = 3
  return {
    ocean: {
      answers: oceanAnswers,
      domains: { O: domain(q(0, 0, 6)), C: domain(q(1, 0, 6)), E: domain(q(2, 0, 6)), A: domain(q(3, 0, 6)), N: domain(q(4, 0, 6)) },
      employer_view: ['Thinks a problem through before acting', 'Keeps commitments visible', 'Steady under pressure']
    },
    sdt: {
      answers: sdtAnswers,
      scales: { autonomy: ev(q(5, 0, 5)), competence: ev(q(1, 0, 5)), relatedness: ev(q(2, 0, 5)) },
      dominant_drivers: ['competence'],
      employer_view: ['Motivated by getting properly good at the work', 'Works well with room to decide', 'Values a team that talks']
    },
    jdr: {
      answers: jdrAnswers,
      scales: {
        demands: ev(q(4, 0, 5)), control: ev(q(1, 0, 5)), manager_support: ev(q(6, 0, 5)), peer_support: ev(q(2, 0, 5)),
        relationships: ev(q(3, 0, 5)), role: ev(q(1, 0, 5)), change: ev(q(0, 0, 5))
      },
      sustainability: 'Sustainable with variety and a team to think with.',
      employer_view: ['Gets energy from working problems through with others', 'Long stretches of solo admin wear them down', 'Handles deadline pressure by working the list']
    },
    spiral: {
      profile: {
        structure_oriented: 55, achievement_oriented: 60, people_oriented: 65, systems_oriented: 50,
        orientation_evidence: { structure_oriented: ev(q(1, 0, 5)), achievement_oriented: ev(q(0, 0, 5)), people_oriented: ev(q(3, 0, 5)), systems_oriented: ev(q(0, 6, 5)) },
        dominant_orientation: 'people_oriented', secondary_orientation: 'achievement_oriented',
        communication_style: 'Direct, with room for everyone to weigh in',
        culture_fit_indicators: ['collaborative teams with clear goals'],
        internal_tags: ['green_primary', 'orange_secondary'],
        summary: 'Collaborative and results-minded.'
      },
      employer_view: ['Relationship-oriented with a results streak', 'Prefers clear goals with room to decide how', 'Adapts to the people in the room']
    },
    confidence: 0.74
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
  const wire = toWireV1(sample)
  const transcript = toTranscript(sample)
  assert.equal(wire.transcript, transcript)
  assert.equal(wire.metadata.source, 'byall_v2')
  assert.equal(wire.metadata.themes.length, sample.exchanges.length)

  openai.setCanned(cannedFor(sample))
  const res = await fetch(`http://127.0.0.1:${port}/api/analyze-combined`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(wire)
  })
  assert.equal(res.status, 200, 'byall expects 200 on a good sitting')
  const body: any = await res.json()

  // --- what byall reads, line by line ---------------------------------------
  assert.equal(typeof body.id, 'string')
  assert.ok(typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1)

  const profile = body.frameworks?.ocean?.profile
  assert.ok(profile && typeof profile === 'object', 'frameworks.ocean.profile must exist')
  for (const letter of ['O', 'C', 'E', 'A', 'N']) {
    const entry = profile[letter]
    assert.ok(entry, `ocean.profile.${letter} must exist`)
    assert.ok(typeof entry.average === 'number' && entry.average >= 1 && entry.average <= 5, `${letter}.average in 1..5`)
    assert.ok(BYALL_LEVELS.includes(entry.level), `${letter}.level must be one of ${BYALL_LEVELS}`)
    assert.ok(Array.isArray(entry.evidence), `${letter}.evidence must be an array`)
    for (const quote of entry.evidence) {
      assert.equal(typeof quote, 'string')
      assert.ok(transcript.includes(quote), `${letter} evidence must be verbatim in the transcript: "${quote}"`)
    }
  }

  for (const fam of FAMILIES) {
    const view = body.frameworks?.[fam]?.employer_view
    assert.ok(Array.isArray(view) && view.every((s: unknown) => typeof s === 'string'), `${fam}.employer_view must be a string array`)
    assert.ok(view.length > 0, `${fam}.employer_view must not be empty — byall takes its first line`)
    if (fam === 'spiral') {
      for (const s of view) assert.ok(!/\b(blue|orange|green|yellow|turquoise|red|purple|beige)\b/i.test(s), `no colour word: ${s}`)
    }
  }
  console.log('PASS byall-compat: everything byall reads is present, typed and in range')

  server.close()
  openai.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
