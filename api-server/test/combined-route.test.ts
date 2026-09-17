// Self-contained route test for POST /api/analyze-combined.
// Run: npm test (= npx tsx test/combined-route.test.ts) from api-server/.
// No network, no Mongo, no OpenAI key needed:
//   - OpenAI is a local canned stub served on 127.0.0.1 (via OPENAI_BASE_URL)
//   - the db module is stubbed through require.cache before the route loads
// Exits non-zero on the first failed assertion.

import http from 'http'
import assert from 'assert'
import express from 'express'

// --- Stubs: the canned model + the db module (shared helper) -------------

import { startOpenAIStub, stubDb } from './helpers/stub-openai'

const { saved: savedDocs } = stubDb()

// --- Fixtures ---------------------------------------------------------------

const TRANSCRIPT = `Interviewer: Tell me about a challenging project you worked on recently.

Candidate: I led a team of five developers to migrate our legacy system to microservices. The biggest challenge was managing stakeholder expectations while maintaining quality. I organized weekly sync meetings and created detailed documentation to keep everyone aligned. When conflicts arose, I brought everyone together to discuss concerns openly.

Interviewer: How do you handle pressure and tight deadlines?

Candidate: I stay calm under pressure by breaking the work into small, clear steps. I genuinely enjoy learning new technologies and I am always curious about better ways to solve problems. Repetitive tasks drain me, but collaborative problem solving gives me a lot of energy. I ask for feedback early and often because it helps me improve quickly.`

import { OCEAN_ITEMS } from '@bigfive-org/transcript-analyzer'
// Big Five: plus-keyed 4 / minus-keyed 2 everywhere -> every domain keyed 4.0 -> high
const OCEAN_ANSWERS: Record<string, number> = {}
for (const item of OCEAN_ITEMS) OCEAN_ANSWERS[String(item.id)] = item.keyed === 'minus' ? 2 : 4
const domain = (evidence: string[]) => ({ reasoning: 'Consistent pattern across answers.', evidence })
const ev = (q: string) => ({ reasoning: 'Stated directly in the interview.', evidence: [q] })

// SDT sheet (18 items, raw as the candidate): autonomy/competence keyed to 4.0 (high), relatedness 3.0 (neutral)
const SDT_ANSWERS = {
  '1': 4, '2': 4, '3': 2, '4': 4, '5': 2, '6': 4,
  '7': 4, '8': 4, '9': 2, '10': 5, '11': 2, '12': 3,
  '13': 3, '14': 3, '15': 3, '16': 3, '17': 3, '18': 3
}
// JD-R sheet (35 HSE items): demands items answered 2 (minus-keyed -> 4.0 high), control 4 (high), rest 3
const JDR_DEMANDS = [3, 6, 9, 12, 16, 18, 20, 22]
const JDR_CONTROL = [2, 10, 15, 19, 25, 30]
const JDR_ANSWERS: Record<string, number> = {}
for (let i = 1; i <= 35; i++) JDR_ANSWERS[String(i)] = JDR_DEMANDS.includes(i) ? 2 : JDR_CONTROL.includes(i) ? 4 : 3

function validPayload() {
  return {
    ocean: {
      answers: { ...OCEAN_ANSWERS },
      domains: {
        O: domain(['I genuinely enjoy learning new technologies']),
        C: domain(['I organized weekly sync meetings and created detailed documentation']),
        E: domain(['I brought everyone together to discuss concerns openly']),
        A: domain(['collaborative problem solving gives me a lot of energy']),
        N: domain(['I stay calm under pressure'])
      },
      employer_view: ['Organized and detail-oriented', 'Curious and eager to learn', 'Calm under pressure']
    },
    sdt: {
      answers: { ...SDT_ANSWERS },
      scales: {
        autonomy: ev('breaking the work into small, clear steps'),
        competence: ev('it helps me improve quickly'),
        relatedness: ev('I brought everyone together')
      },
      dominant_drivers: ['competence', 'autonomy'],
      employer_view: ['Motivated by mastery and growth', 'Works well independently', 'Values regular feedback']
    },
    jdr: {
      answers: { ...JDR_ANSWERS },
      scales: {
        demands: ev('I stay calm under pressure'),
        control: ev('breaking the work into small, clear steps'),
        manager_support: ev('I ask for feedback early and often'),
        peer_support: ev('collaborative problem solving gives me a lot of energy'),
        relationships: ev('discuss concerns openly'),
        role: ev('keep everyone aligned'),
        change: ev('migrate our legacy system to microservices')
      },
      sustainability: 'Sustainable in collaborative environments with variety.',
      employer_view: ['Energized by collaborative problem solving', 'Repetitive tasks drain energy', 'Handles deadline pressure well']
    },
    spiral: {
      profile: {
        structure_oriented: 45, achievement_oriented: 72, people_oriented: 60, systems_oriented: 50,
        orientation_evidence: {
          structure_oriented: ev('created detailed documentation'),
          achievement_oriented: ev('I led a team of five developers'),
          people_oriented: ev('I brought everyone together to discuss concerns openly'),
          systems_oriented: ev('always curious about better ways to solve problems')
        },
        dominant_orientation: 'achievement_oriented', secondary_orientation: 'people_oriented',
        communication_style: 'Data-driven and collaborative',
        culture_fit_indicators: ['thrives in meritocratic environments'],
        internal_tags: ['orange_primary', 'green_secondary'],
        summary: 'Results-driven with a collaborative streak.'
      },
      employer_view: ['Driven by results and efficiency', 'Prioritizes team collaboration', 'Adapts approach to the situation']
    },
    confidence: 0.78
  }
}

// --- Runner -----------------------------------------------------------------

async function main() {
  const openai = await startOpenAIStub()

  // Load the route AFTER env + db stub are in place
  const { analyzeCombinedRouter } = require('../src/routes/analyze-combined')
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/api/analyze-combined', analyzeCombinedRouter)

  const server = http.createServer(app)
  const port = await new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port))
  })
  const url = `http://127.0.0.1:${port}/api/analyze-combined`
  const post = (body: any) => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

  // 1. 400 — transcript under 100 chars (zod validation)
  {
    const res = await post({ transcript: 'too short' })
    assert.equal(res.status, 400)
    const body: any = await res.json()
    assert.equal(body.error, 'Validation error')
    assert.equal(openai.calls, 0)
    console.log('PASS 400 on short transcript (zod)')
  }

  // 2. 400 — >=100 chars but fails the content-quality gate (<100 words)
  {
    const res = await post({ transcript: 'word '.repeat(30).trim() + ' end of this very short transcript text.' })
    assert.equal(res.status, 400)
    const body: any = await res.json()
    assert.equal(body.error, 'Validation error')
    assert.equal(openai.calls, 0)
    console.log('PASS 400 on quality-gate failure')
  }

  // 3. 200 — clean canned payload: contract shape + result-only persistence
  {
    openai.setCanned(validPayload())
    openai.resetCalls()
    savedDocs.length = 0
    const res = await post({ transcript: TRANSCRIPT, candidateName: 'Jane Doe', jobRole: 'Software Engineer', metadata: { referralId: 'r-1' } })
    assert.equal(res.status, 200)
    const body: any = await res.json()

    assert.equal(body.id, 'a1b2c3d4e5f6a7b8c9d0e1f2')
    assert.ok(body.confidence > 0 && body.confidence <= 1)
    assert.equal(typeof body.contentQuality, 'string')
    assert.deepEqual(Object.keys(body.frameworks).sort(), ['jdr', 'ocean', 'sdt', 'spiral'])

    // Big Five — the 120-item sheet: domains of 24, facets of 4, names from the package
    assert.equal(body.frameworks.ocean.instrument, 'ipip-neo-120')
    assert.equal(Object.keys(body.frameworks.ocean.answers).length, 120)
    for (const d of ['O', 'C', 'E', 'A', 'N']) {
      const p = body.frameworks.ocean.profile[d]
      assert.equal(p.count, 24)
      assert.equal(p.score, 96)
      assert.equal(p.average, 4)
      assert.equal(p.percent, 75)
      assert.equal(p.level, 'high')
      assert.equal(typeof p.name, 'string')
      assert.equal(Object.keys(p.facets).length, 6)
      assert.equal(p.facets['1'].count, 4)
      assert.equal(typeof p.reasoning, 'string')
      for (const q of p.evidence) assert.ok(TRANSCRIPT.includes(q), `evidence verbatim: ${q}`)
    }
    assert.ok(Array.isArray(body.frameworks.ocean.employer_view))
    // SDT — a scored sheet, not a gut number; profile is the scales, extras beside it
    const sdt = body.frameworks.sdt
    assert.equal(sdt.instrument, 'byall-sdt-needs-v1')
    assert.equal(sdt.profile.autonomy.score, 24)
    assert.equal(sdt.profile.autonomy.average, 4)
    assert.equal(sdt.profile.autonomy.level, 'high')
    assert.deepEqual(sdt.profile.autonomy.evidence, ['breaking the work into small, clear steps'])
    assert.equal(sdt.profile.relatedness.level, 'neutral')
    assert.deepEqual(sdt.dominant_drivers, ['autonomy', 'competence']) // computed from scores
    assert.deepEqual(sdt.answers, SDT_ANSWERS)
    // JD-R — seven HSE scales, same shape as the others
    const jdr = body.frameworks.jdr
    assert.equal(jdr.instrument, 'hse-msit-v1')
    assert.deepEqual(Object.keys(jdr.profile), ['demands', 'control', 'manager_support', 'peer_support', 'relationships', 'role', 'change'])
    assert.equal(jdr.profile.demands.level, 'high')
    assert.equal(jdr.profile.control.level, 'high')
    assert.equal(jdr.profile.role.level, 'neutral')
    assert.equal(typeof jdr.sustainability, 'string')
    // Spiral — validated numbers with evidence, still internal-only
    const sp = body.frameworks.spiral.profile
    assert.equal(body.frameworks.spiral.instrument, 'byall-spiral-rubric-v1')
    assert.equal(sp.dominant_orientation, 'achievement_oriented')
    assert.equal(sp.orientations.achievement_oriented.score, 72)
    assert.deepEqual(sp.orientations.achievement_oriented.evidence, ['I led a team of five developers'])
    assert.equal(openai.calls, 1)

    // Persistence: ONE result doc, and the transcript text is NOT in it
    assert.equal(savedDocs.length, 1)
    const savedStr = JSON.stringify(savedDocs[0])
    // Evidence QUOTES are persisted by design; the transcript as a whole is not. Probe with a phrase no quote uses.
    assert.ok(!savedStr.includes('managing stakeholder expectations'), 'transcript text must not be persisted')
    assert.equal(savedDocs[0].transcriptLength, TRANSCRIPT.length)
    assert.equal(savedDocs[0].candidateName, 'Jane Doe')
    assert.ok(savedDocs[0].frameworks?.ocean?.profile?.O)
    console.log('PASS 200 contract shape + result-only persistence')
  }

  // 4. 200 — persistent Spiral color label: one retry, then stripped at the response layer
  {
    const canned = validPayload()
    canned.spiral.employer_view = ['Strongly Orange in outlook', 'Prioritizes team collaboration']
    openai.setCanned(canned)
    openai.resetCalls()
    savedDocs.length = 0
    const res = await post({ transcript: TRANSCRIPT })
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(openai.calls, 2, 'one retry expected on Spiral violation')
    assert.deepEqual(body.frameworks.spiral.employer_view, ['Prioritizes team collaboration'])
    // Internal profile keeps its vMEME data (allowed — profile is internal-only)
    assert.deepEqual(body.frameworks.spiral.profile.internal_tags, ['orange_primary', 'green_secondary'])
    // The persisted employer_view is scrubbed too
    assert.deepEqual(savedDocs[0].frameworks.spiral.employer_view, ['Prioritizes team collaboration'])
    console.log('PASS Spiral color label retried then stripped (response + store)')
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
