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
  validateCombinedOutput,
  EvidenceLocator,
  ModelUnavailableError,
  ModelAuthError,
  ModelQuotaError,
  ModelRejectedRequestError,
  ContractViolationError,
  classifyModelError
} = require('../dist/combined-analyzer')
const { scoreSheet, keyedScore, validateSheetAnswers } = require('../dist/instruments/score-sheet')
const { SDT_ITEMS } = require('../dist/instruments/sdt-needs')
const { HSE_MSIT_ITEMS, HSE_MSIT_SCALES } = require('../dist/instruments/hse-msit')
const { OCEAN_ITEMS, scoreOcean } = require('../dist/instruments/ipip-neo-120')
const { COMBINED_SYSTEM_PROMPT } = require('../dist/prompts/combined-assessment')
const { toOceanAnalysis } = require('../dist/ocean-analysis')

// ---------------------------------------------------------------------------
// Fixtures

// >100 words so the content-quality gate passes; contains quotable sentences.
const TRANSCRIPT = `Interviewer: Tell me about a challenging project you worked on recently.

Candidate: I led a team of five developers to migrate our legacy system to microservices. The biggest challenge was managing stakeholder expectations while maintaining quality. I organized weekly sync meetings and created detailed documentation to keep everyone aligned. When conflicts arose, I brought everyone together to discuss concerns openly.

Interviewer: How do you handle pressure and tight deadlines?

Candidate: I stay calm under pressure by breaking the work into small, clear steps. I genuinely enjoy learning new technologies and I am always curious about better ways to solve problems. Repetitive tasks drain me, but collaborative problem solving gives me a lot of energy. I ask for feedback early and often because it helps me improve quickly.`

// Big Five raw answers (as the candidate) chosen so every domain's result is
// known by hand. Per domain, plus-keyed items get P and minus-keyed items get
// M, so the KEYED score of every item in that domain is the same:
//   O: 4 / 2 -> keyed 4 -> 24 items = 96, avg 4.00, high; every facet 16 / 4.00 / high
//   C: 3 / 3 -> keyed 3 -> 72, avg 3.00, neutral
//   E: 2 / 4 -> keyed 2 -> 48, avg 2.00, low
//   A: 5 / 1 -> keyed 5 -> 120, avg 5.00, high
//   N: 3 / 3 -> keyed 3 -> 72, avg 3.00, neutral
const OCEAN_PLAN = { O: [4, 2], C: [3, 3], E: [2, 4], A: [5, 1], N: [3, 3] }
function makeOceanAnswers() {
  const answers = {}
  for (const item of OCEAN_ITEMS) {
    const [plus, minus] = OCEAN_PLAN[item.scale]
    answers[String(item.id)] = item.keyed === 'minus' ? minus : plus
  }
  return answers
}

function makeDomain(evidence) {
  return { reasoning: 'Pattern of curiosity and structured delivery across answers.', evidence }
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
      answers: makeOceanAnswers(),
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
  assert.deepEqual(scored.autonomy, { score: 24, count: 6, average: 4, percent: 75, level: 'high' })
  assert.deepEqual(scored.competence, { score: 24, count: 6, average: 4, percent: 75, level: 'high' })
  assert.deepEqual(scored.relatedness, { score: 18, count: 6, average: 3, percent: 50, level: 'neutral' })
})

test('IPIP-NEO-120: 120 items from the published package, scored per domain and per facet', () => {
  assert.equal(OCEAN_ITEMS.length, 120)
  assert.equal(OCEAN_ITEMS.filter(i => i.keyed === 'minus').length, 55)   // the package's keying
  for (const d of ['O', 'C', 'E', 'A', 'N']) {
    assert.equal(OCEAN_ITEMS.filter(i => i.scale === d).length, 24)
    for (let f = 1; f <= 6; f++) assert.equal(OCEAN_ITEMS.filter(i => i.scale === d && i.facet === f).length, 4)
  }
  const scored = scoreOcean(makeOceanAnswers())
  assert.equal(scored.O.name, 'Openness To Experience')          // from @bigfive-org/results, not typed here
  assert.deepEqual({ score: scored.O.score, count: scored.O.count, average: scored.O.average, percent: scored.O.percent, level: scored.O.level },
                   { score: 96, count: 24, average: 4, percent: 75, level: 'high' })
  assert.equal(scored.O.facets['1'].name, 'Imagination')
  assert.deepEqual({ score: scored.O.facets['1'].score, count: scored.O.facets['1'].count, level: scored.O.facets['1'].level }, { score: 16, count: 4, level: 'high' })
  assert.deepEqual([scored.C.level, scored.E.level, scored.A.level, scored.N.level], ['neutral', 'low', 'high', 'neutral'])
  assert.equal(scored.E.percent, 25)
  assert.equal(scored.A.average, 5)
})

test('the system prompt carries all 173 items and stays under the size budget', () => {
  for (const item of OCEAN_ITEMS) assert.ok(COMBINED_SYSTEM_PROMPT.includes(`${item.id}. ${item.text}`), `missing IPIP item ${item.id}`)
  for (const item of SDT_ITEMS) assert.ok(COMBINED_SYSTEM_PROMPT.includes(item.text), `missing SDT item ${item.id}`)
  for (const item of HSE_MSIT_ITEMS) assert.ok(COMBINED_SYSTEM_PROMPT.includes(item.text), `missing HSE item ${item.id}`)
  // ~4 chars per token: budget 5k tokens for the cached prefix (measured ≈3.4k on 2026-09-17)
  assert.ok(COMBINED_SYSTEM_PROMPT.length < 20000, `system prompt is ${COMBINED_SYSTEM_PROMPT.length} chars`)
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
  assert.deepEqual(scored.demands, { score: 32, count: 8, average: 4, percent: 75, level: 'high' })
  assert.deepEqual(scored.control, { score: 24, count: 6, average: 4, percent: 75, level: 'high' })
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
  assert.match(params.messages[0].content, /Have a vivid imagination/)   // IPIP item 3, from the package

  // Deterministic content-hash seed (same recipe as the OCEAN analyzer)
  const hash = crypto.createHash('md5').update(TRANSCRIPT).digest('hex')
  assert.equal(params.seed, parseInt(hash.substring(0, 8), 16) % 1000000)

  // OCEAN: the 120-item sheet scored per domain (24) and per facet (4), with names, percent, evidence
  const ocean = result.frameworks.ocean
  assert.equal(ocean.instrument, 'ipip-neo-120')
  assert.equal(Object.keys(ocean.answers).length, 120)
  assert.deepEqual([ocean.profile.O.level, ocean.profile.C.level, ocean.profile.E.level, ocean.profile.A.level, ocean.profile.N.level],
                   ['high', 'neutral', 'low', 'high', 'neutral'])
  assert.equal(ocean.profile.O.score, 96)
  assert.equal(ocean.profile.O.count, 24)
  assert.equal(ocean.profile.O.average, 4)
  assert.equal(ocean.profile.O.percent, 75)
  assert.equal(ocean.profile.O.name, 'Openness To Experience')
  assert.equal(ocean.profile.O.facets['5'].name, 'Intellect')
  assert.equal(ocean.profile.O.facets['5'].level, 'high')
  for (const d of ['O', 'C', 'E', 'A', 'N']) {
    const p = ocean.profile[d]
    assert.ok(p.average >= 1 && p.average <= 5)
    assert.ok(p.reasoning.length > 0)
    assert.equal(p.evidence.length, 1)
    assert.ok(TRANSCRIPT.includes(p.evidence[0].text), `evidence must be verbatim: ${p.evidence[0].text}`)
    assert.equal(p.evidence[0].exchange, undefined, 'plain-text path: no exchange number')
    assert.equal(Object.keys(p.facets).length, 6)
  }
  assert.equal(ocean.employer_view.length, 3)

  // SDT: scored sheet + evidence trail + raw answers kept + honest label (profile = the scales, extras beside it)
  const sdt = result.frameworks.sdt
  assert.equal(sdt.instrument, 'byall-sdt-needs-v1')
  assert.deepEqual(sdt.answers, SDT_ANSWERS)
  assert.equal(sdt.profile.autonomy.name, 'Autonomy')
  assert.equal(sdt.profile.autonomy.score, 24)
  assert.equal(sdt.profile.autonomy.average, 4)
  assert.equal(sdt.profile.autonomy.percent, 75)
  assert.equal(sdt.profile.autonomy.level, 'high')
  assert.deepEqual(sdt.profile.autonomy.evidence, [{ text: 'breaking the work into small, clear steps' }])
  assert.ok(sdt.profile.autonomy.reasoning.length > 0)
  assert.equal(sdt.profile.relatedness.level, 'neutral')
  assert.deepEqual(Object.keys(sdt.profile), ['autonomy', 'competence', 'relatedness'])
  assert.deepEqual(sdt.dominant_drivers, ['autonomy', 'competence']) // computed: the two 4.0s, key order

  // JD-R: seven scored HSE scales, same shape
  const jdr = result.frameworks.jdr
  assert.equal(jdr.instrument, 'hse-msit-v1')
  assert.deepEqual(Object.keys(jdr.profile), HSE_MSIT_SCALES.map(s => s.key))
  assert.equal(jdr.profile.demands.name, 'Demands')
  assert.equal(jdr.profile.demands.average, 4)
  assert.equal(jdr.profile.demands.level, 'high')
  assert.deepEqual(jdr.profile.demands.evidence, [{ text: 'I stay calm under pressure' }])
  assert.equal(jdr.profile.control.level, 'high')
  assert.equal(jdr.profile.change.level, 'neutral')
  assert.ok(jdr.sustainability.length > 0)

  // Spiral: orientations carry evidence; profile stays internal; employer view clean
  const sp = result.frameworks.spiral.profile
  assert.equal(result.frameworks.spiral.instrument, 'byall-spiral-rubric-v1')
  assert.equal(sp.dominant_orientation, 'achievement_oriented')
  assert.equal(sp.orientations.achievement_oriented.score, 72)
  assert.deepEqual(sp.orientations.achievement_oriented.evidence, [{ text: 'I led a team of five developers' }])
  assert.deepEqual(sp.internal_tags, ['orange_primary', 'green_secondary'])
  for (const s of result.frameworks.spiral.employer_view) {
    assert.ok(!SPIRAL_COLOR_PATTERN.test(s), `no color labels allowed: ${s}`)
  }

  assert.equal(result.confidence, 0.78)
  assert.equal(result.contract, '2')
  assert.equal(ocean.headline, 'Organized and detail-oriented')
  assert.equal(result.frameworks.spiral.headline, 'Driven by results and efficiency')
  assert.equal(result.metadata.attempts, 1)
  assert.equal(result.metadata.evidenceDropped, 0)
  assert.equal(result.metadata.spiralViewScrubbed, 0)
})

test('the Big Five-only view is derived from the combined result: real counts, 120 keyed answers, per-domain evidence', async () => {
  const { analyzer } = analyzerWith([makeValidOutput()])
  const combined = await analyzer.analyze({ text: TRANSCRIPT })
  const view = toOceanAnalysis(combined)
  assert.deepEqual({ score: view.scores.O.score, count: view.scores.O.count, result: view.scores.O.result }, { score: 96, count: 24, result: 'high' })
  assert.deepEqual(view.scores.O.facet['1'], { score: 16, count: 4, result: 'high' })
  assert.equal(view.scores.E.result, 'low')
  assert.equal(view.answers.length, 120)
  // keyed: the O plan was plus 4 / minus 2 -> every stored O answer is 4
  assert.ok(view.answers.filter(a => a.domain === 'O').every(a => a.score === 4))
  // E plan was plus 2 / minus 4 -> keyed 2
  assert.ok(view.answers.filter(a => a.domain === 'E').every(a => a.score === 2))
  assert.equal(view.evidence.length, 5)
  assert.equal(view.evidence[0].facetName, 'Openness To Experience')
  assert.ok(TRANSCRIPT.includes(view.evidence[0].quote))  // strings again, for the website
  assert.match(view.reasoning, /^Openness To Experience: /)
  assert.equal(view.confidence, 0.78)
})

test('dominant labels are computed from the scores, whatever the model said', async () => {
  const out = makeValidOutput()
  out.sdt.dominant_drivers = ['relatedness'] // the model's pick — ignored
  out.spiral.profile.dominant_orientation = 'structure_oriented' // also ignored
  out.spiral.profile.secondary_orientation = 'systems_oriented'
  const { analyzer } = analyzerWith([out])
  const result = await analyzer.analyze({ text: TRANSCRIPT })
  // autonomy 4.0, competence 4.0, relatedness 3.0 -> the two 4.0s, in key order (stable sort)
  assert.deepEqual(result.frameworks.sdt.dominant_drivers, ['autonomy', 'competence'])
  // 45 / 72 / 60 / 50 -> achievement, then people
  assert.equal(result.frameworks.spiral.profile.dominant_orientation, 'achievement_oriented')
  assert.equal(result.frameworks.spiral.profile.secondary_orientation, 'people_oriented')
})

// ---------------------------------------------------------------------------
// Contract 2: exchanges in, answer-only quotes tagged by exchange, coverage

const EXCHANGES = [
  { n: 1, question: 'Tell me about a challenging project you worked on recently.', themes: ['conscientiousness'],
    answer: 'I led a team of five developers to migrate our legacy system to microservices. The biggest challenge was managing stakeholder expectations while maintaining quality. I organized weekly sync meetings and created detailed documentation to keep everyone aligned. When conflicts arose, I brought everyone together to discuss concerns openly.' },
  { n: 2, question: 'Tell me about a time the pressure got real. How do you handle pressure and tight deadlines?', themes: ['emotional stability', 'energy'],
    answer: 'I stay calm under pressure by breaking the work into small, clear steps. I genuinely enjoy learning new technologies and I am always curious about better ways to solve problems. Repetitive tasks drain me, but collaborative problem solving gives me a lot of energy. I ask for feedback early and often because it helps me improve quickly.' }
]

test('EvidenceLocator: quotes come from answers only, tagged by exchange; a question-only phrase is rejected', () => {
  const loc = new EvidenceLocator(EXCHANGES)
  assert.deepEqual(loc.locate('I stay calm under pressure'), { text: 'I stay calm under pressure', exchange: 2 })
  assert.deepEqual(loc.locate('created detailed documentation'), { text: 'created detailed documentation', exchange: 1 })
  assert.equal(loc.locate('the pressure got real'), null, 'appears only in the interviewer question')
  // plain-text path: whole text, no exchange
  const plain = new EvidenceLocator(undefined, TRANSCRIPT)
  assert.deepEqual(plain.locate('I stay calm under pressure'), { text: 'I stay calm under pressure' })
})

test('exchanges path: evidence carries exchange numbers, coverage counts targeted themes, quotes and neutral items', async () => {
  const out = makeValidOutput()
  out.ocean.confidence = 0.9
  out.sdt.confidence = 0.4
  const { client, analyzer } = analyzerWith([out])
  const result = await analyzer.analyze({ exchanges: EXCHANGES, sitting: { id: 'sit-1', language: 'en', role: 'Engineer' } })
  assert.equal(client.calls.length, 1)
  // the transcript the model saw carries the exchange numbers and themes
  assert.match(client.calls[0].messages[1].content, /Exchange 2 \(themes: emotional stability, energy\)/)
  assert.match(client.calls[0].messages[1].content, /- Job Role: Engineer/)

  assert.deepEqual(result.sitting, { id: 'sit-1', language: 'en', role: 'Engineer' })
  assert.deepEqual(result.frameworks.ocean.profile.N.evidence, [{ text: 'I stay calm under pressure', exchange: 2 }])
  assert.deepEqual(result.frameworks.ocean.profile.C.evidence, [{ text: 'I organized weekly sync meetings and created detailed documentation', exchange: 1 }])

  const c = result.coverage
  assert.equal(c.exchanges, 2)
  assert.equal(c.unanswered, 0)
  assert.ok(c.words > 100)
  assert.equal(c.ocean.targeted, 2)      // conscientiousness + emotional stability
  assert.equal(c.jdr.targeted, 1)        // energy
  assert.equal(c.sdt.targeted, 0)
  assert.equal(c.spiral.targeted, 0)
  assert.equal(c.ocean.quotes, 5)
  assert.equal(c.jdr.quotes, 7)
  assert.equal(c.spiral.quotes, 4)
  assert.equal(c.ocean.confidence, 0.9)  // the model's per-framework confidence
  assert.equal(c.sdt.confidence, 0.4)
  assert.equal(c.jdr.confidence, 0.78)   // absent -> the overall confidence
  // neutral items: the fixture's C domain is all 3s (24), N all 3s (24) -> 48 of 120; SDT relatedness 13-18 -> 6 of 18
  assert.equal(c.ocean.neutral_items, 48)
  assert.equal(c.sdt.neutral_items, 6 + 1)  // + item 12 (3)
  assert.equal(c.spiral.neutral_items, 0)
})

test('the wrong-speaker trap: a quote that exists only in a question is retried, then dropped', async () => {
  const bad = makeValidOutput()
  bad.ocean.domains.N.evidence = ['the pressure got real']    // interviewer's words, verbatim
  const { client, analyzer } = analyzerWith([bad, bad])
  const result = await analyzer.analyze({ exchanges: EXCHANGES })
  assert.equal(client.calls.length, 2)
  assert.match(client.calls[1].messages.at(-1).content, /ocean\.domains\.N evidence is not a verbatim quote from a candidate answer/)
  assert.deepEqual(result.frameworks.ocean.profile.N.evidence, [])
  assert.equal(result.metadata.evidenceDropped, 1)
})

test('coverage counts only exchanges the model saw: blank answers are unanswered, not targeted', async () => {
  const { client, analyzer } = analyzerWith([makeValidOutput()])
  const withBlanks = [
    ...EXCHANGES,
    { n: 3, question: 'What drives you?', answer: '   ', themes: ['motivation'] },
    { n: 4, question: 'What matters?', answer: '', themes: ['values'] }
  ]
  const result = await analyzer.analyze({ exchanges: withBlanks })
  assert.doesNotMatch(client.calls[0].messages[1].content, /Exchange 3/)
  assert.equal(result.coverage.exchanges, 2)
  assert.equal(result.coverage.unanswered, 2)
  assert.equal(result.coverage.sdt.targeted, 0, 'a blank motivation answer did not target SDT')
  assert.equal(result.coverage.spiral.targeted, 0)
})

test('interviewType reaches the prompt as context', async () => {
  const { client, analyzer } = analyzerWith([makeValidOutput()])
  await analyzer.analyze({ text: TRANSCRIPT, interviewType: 'technical', jobRole: 'Engineer' })
  const user = client.calls[0].messages[1].content
  assert.match(user, /- Job Role: Engineer/)
  assert.match(user, /- Interview Type: technical/)
  assert.match(user, /never as a low score/)
})

test('null means "nothing here": evidence/reasoning/optional fields set to null are tolerated, not a contract violation', async () => {
  const out = makeValidOutput()
  out.jdr.scales.change = { reasoning: null, evidence: null }
  out.sdt.scales.relatedness = null
  out.jdr.sustainability = null
  out.spiral.profile.communication_style = null
  out.spiral.profile.culture_fit_indicators = null
  out.spiral.profile.orientation_evidence.systems_oriented = { reasoning: 'x', evidence: null }
  out.ocean.confidence = null
  assert.doesNotThrow(() => validateCombinedOutput(out))
  const { client, analyzer } = analyzerWith([out])
  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 1, 'no retry for a null')
  assert.deepEqual(result.frameworks.jdr.profile.change.evidence, [])
  assert.equal(result.frameworks.jdr.profile.change.reasoning, '')
  assert.deepEqual(result.frameworks.sdt.profile.relatedness.evidence, [])
  assert.equal(result.frameworks.jdr.sustainability, '')
  assert.deepEqual(result.frameworks.spiral.profile.culture_fit_indicators, [])
  assert.equal(result.coverage.ocean.confidence, 0.78, 'null per-framework confidence falls back to overall')
})

test('employer lines are normalised: trimmed, blanks dropped, headline is the first that remains', async () => {
  const out = makeValidOutput()
  out.ocean.employer_view = ['', '  Curious and thorough  ', 'Steady']
  out.spiral.employer_view = ['   ', 'Strongly Orange', '  Adapts to the room ']
  const { analyzer } = analyzerWith([out, out])
  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.deepEqual(result.frameworks.ocean.employer_view, ['Curious and thorough', 'Steady'])
  assert.equal(result.frameworks.ocean.headline, 'Curious and thorough')
  assert.equal(result.frameworks.ocean.headline, result.frameworks.ocean.employer_view[0])
  assert.deepEqual(result.frameworks.spiral.employer_view, ['Adapts to the room'])
  assert.equal(result.frameworks.spiral.headline, 'Adapts to the room')
})

test('model failures are classified: auth, quota and rejected requests are NOT "retry later"', () => {
  const err = (status, code) => Object.assign(new Error(`status ${status}`), { status, code })
  assert.ok(classifyModelError(err(401)) instanceof ModelAuthError)
  assert.ok(classifyModelError(err(403)) instanceof ModelAuthError)
  assert.ok(classifyModelError(err(429, 'insufficient_quota')) instanceof ModelQuotaError)
  assert.ok(classifyModelError(err(429, 'rate_limit_exceeded')) instanceof ModelUnavailableError)
  const rejected = classifyModelError(err(400, 'context_length_exceeded'))
  assert.ok(rejected instanceof ModelRejectedRequestError)
  assert.equal(rejected.code, 'context_length_exceeded')
  assert.ok(classifyModelError(err(500)) instanceof ModelUnavailableError)
  assert.ok(classifyModelError(new Error('ECONNREFUSED')) instanceof ModelUnavailableError)
})

test('typed errors: a dead model is ModelUnavailableError; an invalid sheet after the retry is ContractViolationError', async () => {
  const dead = { chat: { completions: { async create() { throw new Error('ECONNREFUSED') } } } }
  const a1 = new CombinedAnalyzer('k', { client: dead })
  await assert.rejects(() => a1.analyze({ text: TRANSCRIPT }), ModelUnavailableError)

  const bad = makeValidOutput()
  bad.sdt.answers['7'] = 0
  const { analyzer: a2 } = analyzerWith([bad, bad])
  await assert.rejects(() => a2.analyze({ text: TRANSCRIPT }), ContractViolationError)

  const { analyzer: a3 } = analyzerWith([makeValidOutput()])
  await assert.rejects(() => a3.analyze({}), TranscriptQualityError)
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
  assert.match(correction, /ocean\.domains\.O evidence is not a verbatim quote from a candidate answer/)
  assert.equal(result.metadata.attempts, 2)
  assert.equal(result.metadata.evidenceDropped, 0)
  assert.ok(TRANSCRIPT.includes(result.frameworks.ocean.profile.O.evidence[0].text))
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
  assert.deepEqual(result.frameworks.jdr.profile.role.evidence, [{ text: 'keep everyone aligned' }])
  assert.deepEqual(result.frameworks.spiral.profile.orientations.people_oriented.evidence, [])
  assert.equal(result.metadata.evidenceDropped, 3)
})

test('whitespace-mangled evidence is normalized to the exact transcript substring (no retry)', async () => {
  const out = makeValidOutput()
  out.ocean.domains.C.evidence = ['I organized   weekly\nsync meetings'] // whitespace differs
  const { client, analyzer } = analyzerWith([out])

  const result = await analyzer.analyze({ text: TRANSCRIPT })
  assert.equal(client.calls.length, 1)
  const ev = result.frameworks.ocean.profile.C.evidence[0].text
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
  bad.ocean.answers['3'] = 9 // out of 1-5 range
  const { client, analyzer } = analyzerWith([bad, bad])

  await assert.rejects(
    () => analyzer.analyze({ text: TRANSCRIPT }),
    /ocean\.answers\["3"\]/
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

test('the quality gate refuses only NOTHING; a short transcript is scored with coverage saying so', async () => {
  const { client, analyzer } = analyzerWith([makeValidOutput()])
  await assert.rejects(() => analyzer.analyze({ text: '   ' }), TranscriptQualityError)
  await assert.rejects(() => analyzer.analyze({ exchanges: [{ n: 1, question: 'Hi?', answer: '' }] }), TranscriptQualityError)
  assert.equal(client.calls.length, 0)

  const short = 'I just kept going. It was fine in the end.'
  const quiet = makeValidOutput()   // no quotes at all: nothing in this text to quote
  for (const d of ['O', 'C', 'E', 'A', 'N']) quiet.ocean.domains[d].evidence = []
  for (const k of Object.keys(quiet.sdt.scales)) quiet.sdt.scales[k].evidence = []
  for (const k of Object.keys(quiet.jdr.scales)) quiet.jdr.scales[k].evidence = []
  for (const k of Object.keys(quiet.spiral.profile.orientation_evidence)) quiet.spiral.profile.orientation_evidence[k].evidence = []
  const { client: c2, analyzer: a2 } = analyzerWith([quiet])
  const result = await a2.analyze({ text: short })
  assert.equal(c2.calls.length, 1)
  assert.equal(result.metadata.contentQuality, 'poor')
  assert.equal(result.coverage.words, 10)
})

test('findVerbatimEvidence returns null for absent text and exact substring for present text', () => {
  assert.equal(findVerbatimEvidence(TRANSCRIPT, 'completely absent phrase'), null)
  assert.equal(findVerbatimEvidence(TRANSCRIPT, '  I stay calm under pressure  '), 'I stay calm under pressure')
})
