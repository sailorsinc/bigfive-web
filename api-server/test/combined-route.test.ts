// Route test for POST /api/analyze-combined — contract 2.
// Run: npm test (from api-server/). No network, no Mongo, no OpenAI key needed:
//   - OpenAI is a local canned stub served on 127.0.0.1 (via OPENAI_BASE_URL)
//   - the db module is stubbed through require.cache before the route loads
// Exits non-zero on the first failed assertion.

import http from 'http'
import assert from 'assert'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { startOpenAIStub, stubDb } from './helpers/stub-openai'
import { toWireV2 } from '../samples/lib'
import type { Sample } from '../samples/lib'
import { OCEAN_ITEMS } from '@bigfive-org/transcript-analyzer'

const db = stubDb()

function loadSample(name: string): Sample {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', `${name}.json`), 'utf8'))
}

// --- A canned model answer, quoting from the sample's ANSWERS ------------------

const SDT_ANSWERS: Record<string, number> = {
  '1': 4, '2': 4, '3': 2, '4': 4, '5': 2, '6': 4,
  '7': 4, '8': 4, '9': 2, '10': 5, '11': 2, '12': 3,
  '13': 3, '14': 3, '15': 3, '16': 3, '17': 3, '18': 3
}
const JDR_DEMANDS = [3, 6, 9, 12, 16, 18, 20, 22]
const JDR_CONTROL = [2, 10, 15, 19, 25, 30]

function cannedFor(sample: Sample) {
  const a = sample.exchanges.map(e => e.answer)
  const q = (i: number, from: number, len: number) => a[i].split(' ').slice(from, from + len).join(' ')
  const ev = (quote: string) => ({ reasoning: 'Stated directly in the interview.', evidence: [quote] })
  const ocean: Record<string, number> = {}
  for (const item of OCEAN_ITEMS) ocean[String(item.id)] = item.keyed === 'minus' ? 2 : 4
  const jdr: Record<string, number> = {}
  for (let i = 1; i <= 35; i++) jdr[String(i)] = JDR_DEMANDS.includes(i) ? 2 : JDR_CONTROL.includes(i) ? 4 : 3
  return {
    ocean: {
      answers: ocean,
      domains: { O: ev(q(0, 0, 6)), C: ev(q(1, 0, 6)), E: ev(q(2, 0, 6)), A: ev(q(3, 0, 6)), N: ev(q(4, 0, 6)) },
      employer_view: ['Curious and quick to get to grips with the unfamiliar', 'Keeps commitments visible', 'Steady under pressure'],
      confidence: 0.85
    },
    sdt: {
      answers: { ...SDT_ANSWERS },
      scales: { autonomy: ev(q(5, 0, 5)), competence: ev(q(5, 6, 5)), relatedness: ev(q(2, 0, 5)) },
      employer_view: ['Motivated by getting properly good at the work', 'Works well with room to decide', 'Values a team that talks'],
      confidence: 0.55
    },
    jdr: {
      answers: jdr,
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
        structure_oriented: 45, achievement_oriented: 72, people_oriented: 60, systems_oriented: 50,
        orientation_evidence: { structure_oriented: ev(q(1, 0, 5)), achievement_oriented: ev(q(0, 0, 5)), people_oriented: ev(q(3, 0, 5)), systems_oriented: ev(q(7, 0, 5)) },
        communication_style: 'Direct, with room for everyone to weigh in',
        culture_fit_indicators: ['small teams with clear goals'],
        internal_tags: ['orange_primary', 'green_secondary'],
        summary: 'Results-driven with a collaborative streak.'
      },
      employer_view: ['Results-oriented with a collaborative streak', 'Prefers clear goals with room to decide how', 'Adapts to the people in the room'],
      confidence: 0.58
    },
    confidence: 0.78
  }
}

// --- Runner -----------------------------------------------------------------

async function main() {
  const openai = await startOpenAIStub()
  const { analyzeCombinedRouter } = require('../src/routes/analyze-combined')
  const { optionalApiKey } = require('../src/middleware/auth')
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use(optionalApiKey)
  app.use('/api/analyze-combined', analyzeCombinedRouter)
  const server = http.createServer(app)
  const port = await new Promise<number>(resolve => { server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)) })
  const post = (body: any, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}/api/analyze-combined`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
  })

  const sample = loadSample('rig-candidate')
  const wire = toWireV2(sample)

  // 1. The v1 transcript-string request is refused with a reason, not a schema dump
  {
    const res = await post({ transcript: 'Interviewer: hi\nCandidate: hello '.repeat(20), metadata: { source: 'byall_v2' } })
    assert.equal(res.status, 400)
    const body: any = await res.json()
    assert.equal(body.code, 'INVALID_REQUEST')
    assert.equal(body.retry, false)
    assert.match(body.message, /exchanges/)
    assert.equal(openai.calls, 0)
    console.log('PASS 400 INVALID_REQUEST on a v1 transcript body')
  }

  // 2. A candidate name is refused — the scorer holds no names
  {
    const res = await post({ ...wire, candidateName: 'Jane Doe' })
    assert.equal(res.status, 400)
    const body: any = await res.json()
    assert.equal(body.code, 'INVALID_REQUEST')
    assert.match(body.message, /no names/)
    console.log('PASS 400 INVALID_REQUEST on candidateName')
  }

  // 3. NOTHING to score (every answer empty) -> TRANSCRIPT_TOO_SHORT, no model call.
  //    There is no numeric floor: a short sitting is scored and coverage says how thin it was (see 3b).
  {
    const empty = { ...wire, sitting: { ...wire.sitting, id: 'empty' }, exchanges: [{ n: 1, question: 'Hi?', answer: '   ', themes: ['openness'] }] }
    const res = await post(empty)
    assert.equal(res.status, 400)
    const body: any = await res.json()
    assert.equal(body.code, 'TRANSCRIPT_TOO_SHORT')
    assert.equal(body.retry, false)
    assert.equal(openai.calls, 0)
    console.log('PASS 400 TRANSCRIPT_TOO_SHORT only when there is nothing to score')
  }

  // 3b. A one-line sitting is SCORED, and its thinness is visible in coverage
  {
    const thinSample = loadSample('thin-answers')
    const one = { ...wire, sitting: { ...wire.sitting, id: 'thin' }, exchanges: [{ ...thinSample.exchanges[0] }] }
    const canned = cannedFor(thinSample)
    // the canned model has no quotes for exchanges that were not sent; give it none at all, all items 3
    for (const d of ['O', 'C', 'E', 'A', 'N']) canned.ocean.domains[d].evidence = []
    for (const k of Object.keys(canned.sdt.scales)) canned.sdt.scales[k].evidence = []
    for (const k of Object.keys(canned.jdr.scales)) canned.jdr.scales[k].evidence = []
    for (const k of Object.keys(canned.spiral.profile.orientation_evidence)) canned.spiral.profile.orientation_evidence[k].evidence = []
    for (const k of Object.keys(canned.ocean.answers)) canned.ocean.answers[k] = 3
    for (const k of Object.keys(canned.sdt.answers)) canned.sdt.answers[k] = 3
    for (const k of Object.keys(canned.jdr.answers)) canned.jdr.answers[k] = 3
    openai.setCanned(canned)
    openai.resetCalls()
    db.reset()
    const res = await post(one)
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(openai.calls, 1)
    assert.equal(body.coverage.exchanges, 1)
    assert.equal(body.coverage.unanswered, 0)
    assert.equal(body.coverage.ocean.quotes, 0)
    assert.equal(body.coverage.ocean.neutral_items, 120)
    assert.equal(body.coverage.sdt.neutral_items, 18)
    assert.equal(body.frameworks.ocean.profile.O.level, 'neutral')
    assert.equal(body.contentQuality, 'poor')
    console.log('PASS thin sitting scored, thinness visible in coverage')
  }

  // 4. 200 — the contract-2 shape, and result-only persistence with no name and no text
  let firstId: string
  {
    openai.setCanned(cannedFor(sample))
    openai.resetCalls()
    db.reset()
    const res = await post(wire)
    assert.equal(res.status, 200)
    const body: any = await res.json()
    firstId = body.id
    assert.equal(body.contract, '2')
    assert.deepEqual(body.sitting, wire.sitting)
    assert.equal(typeof body.id, 'string')
    assert.equal(body.confidence, 0.78)
    assert.equal(body.meta.replayed, false)
    assert.equal(body.meta.attempts, 1)
    assert.equal(body.meta.quotes_dropped, 0)

    // coverage: 5 Big Five themes, 1 motivation, 1 energy, 1 values
    assert.deepEqual(
      [body.coverage.ocean.targeted, body.coverage.sdt.targeted, body.coverage.jdr.targeted, body.coverage.spiral.targeted],
      [5, 1, 1, 1])
    assert.equal(body.coverage.exchanges, 8)
    assert.equal(body.coverage.unanswered, 0)
    assert.equal(body.coverage.ocean.confidence, 0.85)
    assert.equal(body.coverage.sdt.confidence, 0.55)

    // Big Five: 120-item sheet, evidence objects tagged by exchange
    const ocean = body.frameworks.ocean
    assert.equal(ocean.instrument, 'ipip-neo-120')
    assert.equal(Object.keys(ocean.answers).length, 120)
    assert.equal(ocean.headline, 'Curious and quick to get to grips with the unfamiliar')
    for (const d of ['O', 'C', 'E', 'A', 'N']) {
      const p = ocean.profile[d]
      assert.equal(p.count, 24); assert.equal(p.average, 4); assert.equal(p.percent, 75); assert.equal(p.level, 'high')
      assert.equal(Object.keys(p.facets).length, 6)
      assert.equal(p.evidence.length, 1)
      const { text, exchange } = p.evidence[0]
      assert.ok(sample.exchanges[exchange - 1].answer.includes(text), `quote must be in exchange ${exchange}'s answer`)
    }
    // SDT / JD-R / Spiral: same shape, extras beside profile
    const sdt = body.frameworks.sdt
    assert.equal(sdt.instrument, 'byall-sdt-needs-v1')
    assert.equal(sdt.profile.autonomy.level, 'high')
    assert.deepEqual(sdt.profile.autonomy.evidence[0], { text: 'Getting properly good at something.', exchange: 6 })
    assert.deepEqual(sdt.dominant_drivers, ['autonomy', 'competence'])
    const jdr = body.frameworks.jdr
    assert.equal(jdr.instrument, 'hse-msit-v1')
    assert.deepEqual(Object.keys(jdr.profile), ['demands', 'control', 'manager_support', 'peer_support', 'relationships', 'role', 'change'])
    assert.equal(jdr.profile.demands.level, 'high')
    assert.equal(jdr.profile.role.level, 'neutral')
    assert.equal(typeof jdr.headline, 'string')
    const sp = body.frameworks.spiral
    assert.equal(sp.instrument, 'byall-spiral-rubric-v1')
    assert.equal(sp.profile.dominant_orientation, 'achievement_oriented')
    assert.equal(sp.profile.orientations.achievement_oriented.evidence[0].exchange, 1)

    // Persistence: one doc, the sitting, no transcript text, no name
    assert.equal(db.saved.length, 1)
    const savedStr = JSON.stringify(db.saved[0])
    assert.deepEqual(db.saved[0].sitting, wire.sitting)
    assert.ok(!savedStr.includes('mapped the whole system out'), 'transcript text must not be persisted')
    assert.ok(!savedStr.includes('candidateName'))
    assert.equal(db.saved[0].exchangeCount, 8)
    assert.equal(openai.calls, 1)
    console.log('PASS 200 contract-2 shape + result-only persistence')
  }

  // 5. Idempotent: the same sitting id again -> same result id, no model call, replayed
  {
    openai.resetCalls()
    const res = await post(wire)
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(body.id, firstId)
    assert.equal(body.meta.replayed, true)
    assert.equal(body.contract, '2')
    assert.equal(body.frameworks.ocean.profile.O.level, 'high')
    assert.equal(openai.calls, 0)
    assert.equal(db.saved.length, 1, 'no second row')
    console.log('PASS idempotent replay on sitting.id')
  }

  // 5b. The same sitting id with DIFFERENT answers is a client fault, never another interview's result
  {
    openai.resetCalls()
    const altered = { ...wire, exchanges: wire.exchanges.map((e, i) => i === 0 ? { ...e, answer: 'Something completely different this time.' } : e) }
    const res = await post(altered)
    assert.equal(res.status, 409)
    const body: any = await res.json()
    assert.equal(body.code, 'SITTING_CONFLICT')
    assert.equal(body.retry, false)
    assert.equal(openai.calls, 0)
    assert.equal(db.saved.length, 1)
    console.log('PASS 409 SITTING_CONFLICT on a reused id with different answers')
  }

  // 5c. Idempotency is scoped to the caller: another API key with the same sitting id is its own sitting
  {
    process.env.API_KEYS = 'key-for-client-b'
    openai.setCanned(cannedFor(sample))
    openai.resetCalls()
    const res = await post(wire, { 'x-api-key': 'key-for-client-b' })
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(body.meta.replayed, false, 'a different caller is not served the public result')
    assert.equal(openai.calls, 1)
    assert.equal(db.saved.length, 2)
    assert.notEqual(db.saved[1].owner, db.saved[0].owner)
    assert.ok(!db.saved[1].owner.includes('key-for-client-b'), 'the raw key is never stored')
    delete process.env.API_KEYS
    console.log('PASS idempotency scoped to the caller (owner = hashed API key)')
  }

  // 6. The wrong-speaker trap: a quote only in a QUESTION is retried, then dropped
  {
    const trap = loadSample('wrong-speaker-trap')
    const trapWire = toWireV2(trap)
    const canned = cannedFor(trap)
    canned.ocean.domains.N.evidence = ['the pressure got real']   // the interviewer's words, verbatim in the question
    openai.setCanned(canned)
    openai.resetCalls()
    db.reset()
    const res = await post(trapWire)
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(openai.calls, 2, 'one retry')
    assert.deepEqual(body.frameworks.ocean.profile.N.evidence, [])
    assert.equal(body.meta.quotes_dropped, 1)
    console.log('PASS wrong-speaker quote retried then dropped')
  }

  // 7. Spiral colour label: one retry, then stripped at the response layer; headline follows
  {
    const canned = cannedFor(sample)
    canned.spiral.employer_view = ['Strongly Orange in outlook', 'Prioritizes team collaboration']
    openai.setCanned(canned)
    openai.resetCalls()
    db.reset()
    const res = await post({ ...wire, sitting: { ...wire.sitting, id: 'sit-spiral' } })
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(openai.calls, 2)
    assert.deepEqual(body.frameworks.spiral.employer_view, ['Prioritizes team collaboration'])
    assert.equal(body.frameworks.spiral.headline, 'Prioritizes team collaboration')
    assert.deepEqual(body.frameworks.spiral.profile.internal_tags, ['orange_primary', 'green_secondary'])
    assert.deepEqual(db.saved[0].analysis.frameworks.spiral.employer_view, ['Prioritizes team collaboration'])
    console.log('PASS Spiral colour label retried then stripped (response + store)')
  }

  // 8. The model is down -> 502 MODEL_UNAVAILABLE (retry later), nothing stored
  {
    openai.setFailing(503)
    openai.resetCalls()
    db.reset()
    const res = await post({ ...wire, sitting: { ...wire.sitting, id: 'sit-down' } })
    openai.setFailing(false)
    assert.equal(res.status, 502)
    const body: any = await res.json()
    assert.equal(body.code, 'MODEL_UNAVAILABLE')
    assert.equal(body.retry, true)
    assert.equal(db.saved.length, 0)
    console.log('PASS 502 MODEL_UNAVAILABLE when the model is down (retry: true)')
  }

  // 8b. Non-retryable model failures are told apart: credentials, quota, a too-long request
  {
    const cases: Array<[number, string | undefined, number, string]> = [
      [401, undefined, 500, 'MODEL_AUTH'],
      [429, 'insufficient_quota', 503, 'MODEL_QUOTA'],
      [400, 'context_length_exceeded', 422, 'TRANSCRIPT_TOO_LONG']
    ]
    for (const [status, code, expectStatus, expectCode] of cases) {
      openai.setFailing(status, code)
      openai.resetCalls()
      db.reset()
      const res = await post({ ...wire, sitting: { ...wire.sitting, id: `sit-${status}-${code}` } })
      openai.setFailing(false)
      assert.equal(res.status, expectStatus, `${status} ${code} -> ${expectStatus}`)
      const body: any = await res.json()
      assert.equal(body.code, expectCode)
      assert.equal(body.retry, false, `${expectCode} is not retryable`)
      assert.equal(db.saved.length, 0)
    }
    console.log('PASS model failures classified: MODEL_AUTH 500, MODEL_QUOTA 503, TRANSCRIPT_TOO_LONG 422 (retry: false)')
  }

  // 9. The model answers nonsense twice -> 502 CONTRACT_VIOLATION
  {
    openai.setCanned({ nonsense: true })
    openai.resetCalls()
    db.reset()
    const res = await post({ ...wire, sitting: { ...wire.sitting, id: 'sit-nonsense' } })
    assert.equal(res.status, 502)
    const body: any = await res.json()
    assert.equal(body.code, 'CONTRACT_VIOLATION')
    assert.equal(body.retry, true)
    assert.equal(openai.calls, 2)
    console.log('PASS 502 CONTRACT_VIOLATION after one retry (retry: true)')
  }

  server.close()
  openai.close()
  console.log('ALL ROUTE TESTS PASSED')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
