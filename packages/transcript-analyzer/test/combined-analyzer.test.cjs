// Unit tests for the combined four-framework analyzer.
// Run: node --test test/  (from packages/transcript-analyzer, after `npm run build`)
// The OpenAI call is served by the CombinedAnalyzer's injectable client — no network.
//
// V1 sheets: SDT (18 items) and JD-R (35 HSE MSIT items) are ANSWERED by the
// model and SCORED here. The fixtures below choose raw answers whose scored
// result is known by hand, so the arithmetic (minus-keying, sum, average,
// cut-offs) is asserted exactly.

const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

const {
  CombinedAnalyzer,
  TranscriptQualityError,
  SPIRAL_COLOR_PATTERN,
  scrubSpiralEmployerView,
  findVerbatimEvidence,
  validateCombinedOutput
} = require('../dist/combined-analyzer')
const { scoreSheet, keyedScore, validateSheetAnswers } = require('../dist/instruments/score-sheet')
const { SDT_ITEMS } = require('../dist/instruments/sdt-needs')
const { HSE_MSIT_ITEMS, HSE_MSIT_SCALES } = require('../dist/instruments/hse-msit')

// ---------------------------------------------------------------------------
// Fixtures

// >100 words so the content-quality gate passes; contains quotable sentences.
const TRANSCRIPT = `Interviewer: Tell me about a challenging project you worked on recently.

Candidate: I led a team of five developers to migrate our legacy system to microservices. The biggest challenge was managing stakeholder expectations while maintaining quality. I organized weekly sync meetings and created detailed documentation to keep everyone aligned. When conflicts arose, I brought everyone together to discuss concerns openly.

Interviewer: How do you handle pressure and tight deadlines?

Candidate: I stay calm under pressure by breaking the work into small, clear steps. I genuinely enjoy learning new technologies and I am always curious about better ways to solve problems. Repetitive tasks drain me, but collaborative problem solving gives me a lot of energy. I ask for feedback early and often because it helps me improve quickly.`

const FACETS = { '1': 4, '2': 3, '3': 4, '4': 3, '5': 5, '6': 3 }

function makeDomain(evidence) {
  return {
    facets: { ...FACETS },
    reasoning: 'Pattern of curiosity and structured delivery across answers.',
    evidence
  }
}

// SDT raw answers (as the candidate; minus-keyed items answered LOW so that
// keying flips them high):
//   autonomy    1-6:   4 4 2 4 2 4  -> keyed 4 4 4 4 4 4 = 24, avg 4.00, high
//   competence  7-12:  4 4 2 5 2 3  -> keyed 4 4 4 5 4 3 = 24, avg 4.00, high
//   relatedness 13-18: all 3        -> 18, avg 3.00, neutral
const SDT_ANSWERS = {
  '1': 4, '2': 4, '3': 2, '4': 4, '5': 2, '6': 4,
  '7': 4, '8': 4, '9': 2, '10': 5, '11': 2, '12': 3,
  '13': 3, '14': 3, '15': 3, '16': 3, '17': 3, '18': 3
}

// JD-R raw answers: everything 3 (neutral) except
//   demands items (minus-keyed) answered 2 -> keyed 4 -> avg 4.00, high
//   control items (plus-keyed) answered 4  -> avg 4.00, high
function makeJdrAnswers() {
  const answers = {}
  for (const item of HSE_MSIT_ITEMS) {
    answers[String(item.id)] = item.scale === 'demands' ? 2 : item.scale === 'control' ? 4 : 3
  }
  return answers
}

const EV = (q) => ({ reasoning: 'Stated directly in the interview.', evidence: [q] })

function makeValidOutput(overrides = {}) {
  const base = {
    ocean: {
      domains: {
        O: makeDomain(['I genuinely enjoy learning new technologies']),
        C: makeDomain(['I organized weekly sync meetings and created detailed documentation']),
        E: makeDomain(['I brought everyone together to discuss concerns openly']),
        A: makeDomain(['collaborative problem solving gives me a lot of energy']),
        N: makeDomain(['I stay calm under pressure'])
      },
      employer_view: ['Organized and detail-oriented', 'Curious and eager to learn', 'Calm under pressure']
    },
    sdt: {
      answers: { ...SDT_ANSWERS },
      scales: {
        autonomy: EV('breaking the work into small, clear steps'),
        competence: EV('it helps me improve quickly'),
        relatedness: EV('I brought everyone together')
      },
      dominant_drivers: ['competence', 'autonomy'],
      employer_view: ['Motivated by mastery and growth', 'Works well with independence', 'Values regular feedback']
    },
    jdr: {
      answers: makeJdrAnswers(),
      scales: {
        demands: EV('I stay calm under pressure'),
        control: EV('breaking the work into small, clear steps'),
        manager_support: EV('I ask for feedback early and often'),
        peer_support: EV('collaborative problem solving gives me a lot of energy'),
        relationships: EV('discuss concerns openly'),
        role: EV('keep everyone aligned'),
        change: EV('migrate our legacy system to microservices')
      },
      sustainability: 'Sustainable in collaborative environments with variety; repetitive work depletes energy.',
      employer_view: ['Energized by collaborative problem solving', 'Repetitive tasks drain energy', 'Handles deadline pressure well']
    },
    spiral: {
      profile: {
        structure_oriented: 45,
        achievement_oriented: 72,
        people_oriented: 60,
        systems_oriented: 50,
        orientation_evidence: {
          structure_oriented: EV('created detailed documentation'),
          achievement_oriented: EV('I led a team of five developers'),
          people_oriented: EV('I brought everyone together to discuss concerns openly'),
          systems_oriented: EV('always curious about better ways to solve problems')
        },
        dominant_orientation: 'achievement_oriented',
        secondary_orientation: 'people_oriented',
        communication_style: 'Data-driven discussions with collaborative decisions',
        culture_fit_indicators: ['thrives in meritocratic environments'],
        internal_tags: ['orange_primary', 'green_secondary'],
        summary: 'Results-driven with a strong collaborative streak.'
      },
      employer_view: ['Driven by results and efficiency', 'Prioritizes team collaboration', 'Adapts approach to the situation']
    },
    confidence: 0.78
  }
  return JSON.parse(JSON.stringify({ ...base, ...overrides }))
}

class FakeClient {
  constructor(responses) {
    // Each entry: an object to be JSON.stringified as the completion content
    this.responses = responses
    this.calls = []
  }
  get chat() {
    const self = this
    return {
      completions: {
        async create(params) {
          self.calls.push(params)
          const payload = self.responses[Math.min(self.calls.length - 1, self.responses.length - 1)]
          return {
            choices: [{ message: { content: JSON.stringify(payload) } }],
            usage: { total_tokens: 42 },
            system_fingerprint: 'fp_test'
          }
        }
      }
    }
  }
}

function analyzerWith(responses) {
  const client = new FakeClient(responses)
  const analyzer = new CombinedAnalyzer('test-key', { client, model: 'gpt-4o' })
  return { client, analyzer }
}

// ---------------------------------------------------------------------------
// The sheet arithmetic (no model involved)

test('scoreSheet reverses minus-keyed items and applies the shared cut-offs', () => {
  const minusItem = SDT_ITEMS.find(i => i.keyed === 'minus')
  assert.equal(keyedScore(minusItem, 2), 4)
  assert.equal(keyedScore(minusItem, 5), 1)
  const plusItem = SDT_ITEMS.find(i => i.keyed === 'plus')
  assert.equal(keyedScore(plusItem, 2), 2)

  const scored = scoreSheet(SDT_ITEMS, SDT_ANSWERS)
  assert.deepEqual(scored.autonomy, { score: 24, count: 6, average: 4, level: 'high' })
  assert.deepEqual(scored.competence, { score: 24, count: 6, average: 4, level: 'high' })
  assert.deepEqual(scored.relatedness, { score: 18, count: 6, average: 3, level: 'neutral' })
})

test('HSE MSIT: 35 items, 7 scales, item counts match the HSE analysis tool', () => {
  assert.equal(HSE_MSIT_ITEMS.length, 35)
  const counts = {}
  for (const i of HSE_MSIT_ITEMS) counts[i.scale] = (counts[i.scale] || 0) + 1
  assert.deepEqual(counts, {
    demands: 8, control: 6, manager_support: 5, peer_support: 4, relationships: 4, role: 5, change: 3
  })
  assert.deepEqual(HSE_MSIT_SCALES.map(s => s.key).sort(), Object.keys(counts).sort())
  // every demands item is minus-keyed (a high raw answer is BAD)
  assert.ok(HSE_MSIT_ITEMS.filter(i => i.scale === 'demands').every(i => i.keyed === 'minus'))

  const scored = scoreSheet(HSE_MSIT_ITEMS, makeJdrAnswers())
  assert.deepEqual(scored.demands, { score: 32, count: 8, average: 4, level: 'high' })
  assert.deepEqual(scored.control, { score: 24, count: 6, average: 4, level: 'high' })
  assert.equal(scored.role.level, 'neutral')
})

test('validateSheetAnswers rejects a missing item and an out-of-range answer', () => {
  const missing = { ...SDT_ANSWERS }
  delete missing['9']
  assert.throws(() => validateSheetAnswers(SDT_ITEMS, missing, 'sdt'), /sdt\.answers\["9"\]/)
  assert.throws(() => validateSheetAnswers(SDT_ITEMS, { ...SDT_ANSWERS, '4': 6 }, 'sdt'), /sdt\.answers\["4"\]/)
})

// ---------------------------------------------------------------------------
// Happy path

test('happy path: contract shape, one call, deterministic seed, scored sheets', async () => {
  const { client, analyzer } = analyzerWith([makeValidOutput()])
  const result = await analyzer.analyze({ text: TRANSCRIPT, candidateName: 'Jane', jobRole: 'Engineer' })

  assert.equal(client.calls.length, 1)
  const params = client.calls[0]
  assert.equal(params.model, 'gpt-4o')
  assert.equal(params.temperature, 0.1)
  assert.deepEqual(params.response_format, { type: 'json_object' })
  // The item pools are in the system prompt (the cached prefix)
  assert.match(params.messages[0].content, /I am clear what is expected of me at work/)
  assert.match(params.messages[0].content, /I feel free to decide how I go about my work/)

  // Deterministic content-hash seed (same recipe as the OCEAN analyzer)
  const hash = crypto.createHash('md5').update(TRANSCRIPT).digest('hex')
  assert.equal(params.seed, parseInt(hash.substring(0, 8), 16) % 1000000)

  // OCEAN per-domain: score 6-30, average 1-5, level, reasoning, evidence[]
  for (const d of ['O', 'C', 'E', 'A', 'N']) {
    const p = result.frameworks.ocean.profile[d]
    assert.equal(p.score, 22) // 4+3+4+3+5+3
    assert.equal(p.average, 3.67)
    assert.equal(p.level, 'high') // 22/6 = 3.67 > 3.5
    assert.ok(p.reasoning.length > 0)
    assert.equal(p.evidence.length, 1)
    assert.ok(TRANSCRIPT.includes(p.evidence[0]), `evidence must be verbatim: ${p.evidence[0]}`)
  }
  assert.equal(result.frameworks.ocean.employer_view.length, 3)

  // SDT: scored sheet + evidence trail + raw answers kept + honest label
  const sdt = result.frameworks.sdt.profile
  assert.equal(sdt.instrument, 'byall-sdt-needs-v1')
  assert.deepEqual(sdt.answers, SDT_ANSWERS)
  assert.equal(sdt.autonomy.score, 24)
  assert.equal(sdt.autonomy.average, 4)
  assert.equal(sdt.autonomy.level, 'high')
  assert.deepEqual(sdt.autonomy.evidence, ['breaking the work into small, clear steps'])
  assert.ok(sdt.autonomy.reasoning.length > 0)
  assert.equal(sdt.relatedness.level, 'neutral')
  assert.deepEqual(sdt.dominant_drivers, ['autonomy', 'competence']) // computed: the two 4.0s, key order

  // JD-R: seven scored HSE scales + backward-compatible summaries
  const jdr = result.frameworks.jdr.profile
  assert.equal(jdr.instrument, 'hse-msit-v1')
  assert.deepEqual(Object.keys(jdr.scales), HSE_MSIT_SCALES.map(s => s.key))
  assert.equal(jdr.scales.demands.average, 4)
  assert.equal(jdr.scales.demands.level, 'high')
  assert.deepEqual(jdr.scales.demands.evidence, ['I stay calm under pressure'])
  assert.equal(jdr.scales.control.level, 'high')
  assert.equal(jdr.scales.change.level, 'neutral')
  assert.equal(jdr.demands, undefined, 'the pre-sheet demands/resources pair is gone')
  assert.equal(jdr.resources, undefined)
  assert.ok(jdr.sustainability.length > 0)

  // Spiral: orientations carry evidence; profile stays internal; employer view clean
  const sp = result.frameworks.spiral.profile
  assert.equal(sp.instrument, 'byall-spiral-rubric-v1')
  assert.equal(sp.dominant_orientation, 'achievement_oriented')
  assert.equal(sp.orientations.achievement_oriented.score, 72)
  assert.deepEqual(sp.orientations.achievement_oriented.evidence, ['I led a team of five developers'])
  assert.deepEqual(sp.internal_tags, ['orange_primary', 'green_secondary'])
  for (const s of result.frameworks.spiral.employer_view) {
    assert.ok(!SPIRAL_COLOR_PATTERN.test(s), `no color labels allowed: ${s}`)
  }

  assert.equal(result.confidence, 0.78)
  assert.equal(result.metadata.attempts, 1)
  assert.equal(result.metadata.evidenceDropped, 0)
  assert.equal(result.metadata.spiralViewScrubbed, 0)
})

test('dominant labels are computed from the scores, whatever the model said', async () => {
  const out = makeValidOutput()
  out.sdt.dominant_drivers = ['relatedness'] // the model's pick — ignored
  out.spiral.profile.dominant_orientation = 'structure_oriented' // also ignored
  out.spiral.profile.secondary_orientation = 'systems_oriented'
  const { analyzer } = analyzerWith([out])
  const result = await analyzer.analyze({ text: TRANSCRIPT })
  // autonomy 4.0, competence 4.0, relatedness 3.0 -> the two 4.0s, in key order (stable sort)
  assert.deepEqual(result.frameworks.sdt.profile.dominant_drivers, ['autonomy', 'competence'])
  // 45 / 72 / 60 / 50 -> achievement, then people
  assert.equal(result.frameworks.spiral.profile.dominant_orientation, 'achievement_oriented')
  assert.equal(result.frameworks.spiral.profile.secondary_orientation, 'people_oriented')
})

// ---------------------------------------------------------------------------
// Evidence verbatim enforcement — now for every framework

test('non-verbatim OCEAN evidence triggers exactly one retry, second response used', async () => {
  const bad = makeValidOutput()
  bad.ocean.domains.O.evidence = ['This sentence is definitely not in the transcript at all']
  const { client, analyzer } = analyzerWith([bad, makeValidOutput()])

  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 2)
  // The retry carries a corrective message naming the violation
  const retryMessages = client.calls[1].messages
  const correction = retryMessages[retryMessages.length - 1].content
  assert.match(correction, /ocean\.O evidence is not a verbatim transcript substring/)
  assert.equal(result.metadata.attempts, 2)
  assert.equal(result.metadata.evidenceDropped, 0)
  assert.ok(TRANSCRIPT.includes(result.frameworks.ocean.profile.O.evidence[0]))
})

test('non-verbatim SDT / JD-R / Spiral evidence is retried and then dropped, same as OCEAN', async () => {
  const bad = makeValidOutput()
  bad.sdt.scales.competence.evidence = ['invented competence quote']
  bad.jdr.scales.role.evidence = ['invented role quote', 'keep everyone aligned'] // second is verbatim
  bad.spiral.profile.orientation_evidence.people_oriented.evidence = ['invented spiral quote']
  const { client, analyzer } = analyzerWith([bad, bad])

  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 2)
  const correction = client.calls[1].messages.at(-1).content
  assert.match(correction, /sdt\.scales\.competence evidence/)
  assert.match(correction, /jdr\.scales\.role evidence/)
  assert.match(correction, /spiral\.profile\.orientation_evidence\.people_oriented evidence/)

  assert.deepEqual(result.frameworks.sdt.profile.competence.evidence, [])
  assert.deepEqual(result.frameworks.jdr.profile.scales.role.evidence, ['keep everyone aligned'])
  assert.deepEqual(result.frameworks.spiral.profile.orientations.people_oriented.evidence, [])
  assert.equal(result.metadata.evidenceDropped, 3)
})

test('whitespace-mangled evidence is normalized to the exact transcript substring (no retry)', async () => {
  const out = makeValidOutput()
  out.ocean.domains.C.evidence = ['I organized   weekly\nsync meetings'] // whitespace differs
  const { client, analyzer } = analyzerWith([out])

  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 1)
  const ev = result.frameworks.ocean.profile.C.evidence[0]
  assert.ok(TRANSCRIPT.includes(ev), 'normalized evidence must be an exact transcript substring')
  assert.match(ev, /^I organized weekly sync meetings/)
})

// ---------------------------------------------------------------------------
// Spiral employer_view scrub

test('spiral color label triggers a retry; persistent violation is stripped', async () => {
  const bad = makeValidOutput()
  bad.spiral.employer_view = [
    'Strongly Orange in outlook', // violation
    'Prioritizes team collaboration' // clean
  ]
  const { client, analyzer } = analyzerWith([bad, bad])

  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 2)
  assert.deepEqual(result.frameworks.spiral.employer_view, ['Prioritizes team collaboration'])
  assert.equal(result.metadata.spiralViewScrubbed, 1)
  // Internal profile keeps its vMEME data
  assert.deepEqual(result.frameworks.spiral.profile.internal_tags, ['orange_primary', 'green_secondary'])
})

test('scrubSpiralEmployerView catches all eight vMEME color words, case-insensitive', () => {
  const colors = ['Blue', 'orange', 'GREEN', 'Yellow', 'turquoise', 'Red', 'Purple', 'beige']
  const view = colors.map(c => `Shows a ${c} tendency`)
  view.push('Values clear processes and procedures')
  const { clean, violations } = scrubSpiralEmployerView(view)
  assert.equal(violations.length, 8)
  assert.deepEqual(clean, ['Values clear processes and procedures'])
})

// ---------------------------------------------------------------------------
// Hard validation + quality gate

test('structurally invalid OCEAN output on both attempts throws', async () => {
  const bad = makeValidOutput()
  bad.ocean.domains.O.facets['3'] = 9 // out of 1-5 range
  const { client, analyzer } = analyzerWith([bad, bad])

  await assert.rejects(
    () => analyzer.analyze({ text: TRANSCRIPT }),
    /Invalid score for O-3/
  )
  assert.equal(client.calls.length, 2)
})

test('validateCombinedOutput: sheets must be complete, Spiral numbers are really checked', () => {
  assert.doesNotThrow(() => validateCombinedOutput(makeValidOutput()))

  const missingItem = makeValidOutput()
  delete missingItem.jdr.answers['35']
  assert.throws(() => validateCombinedOutput(missingItem), /jdr\.answers\["35"\]/)

  const badSpiral = makeValidOutput()
  badSpiral.spiral.profile.people_oriented = 140
  assert.throws(() => validateCombinedOutput(badSpiral), /spiral\.profile\.people_oriented/)

  const emptySpiral = makeValidOutput()
  emptySpiral.spiral.profile = {}
  assert.throws(() => validateCombinedOutput(emptySpiral), /spiral\.profile\.structure_oriented/)

  const badDominant = makeValidOutput()
  badDominant.spiral.profile.dominant_orientation = 42 // not a string
  assert.throws(() => validateCombinedOutput(badDominant), /dominant_orientation/)
})

test('too-short transcript fails the quality gate without any API call', async () => {
  const { client, analyzer } = analyzerWith([makeValidOutput()])
  // >100 chars (passes route-level zod) but <100 words (fails quality gate)
  const short = 'word '.repeat(30).trim() + ' end of this very short transcript text.'
  assert.ok(short.length >= 100)

  await assert.rejects(
    () => analyzer.analyze({ text: short }),
    TranscriptQualityError
  )
  assert.equal(client.calls.length, 0)
})

test('findVerbatimEvidence returns null for absent text and exact substring for present text', () => {
  assert.equal(findVerbatimEvidence(TRANSCRIPT, 'completely absent phrase'), null)
  assert.equal(findVerbatimEvidence(TRANSCRIPT, '  I stay calm under pressure  '), 'I stay calm under pressure')
})
