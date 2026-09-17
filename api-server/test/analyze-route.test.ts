// Route test for POST /api/analyze — the Big Five-only endpoint the website
// and older integrations use. There was no test for this route before phase 4;
// this pins the response and stored-document shape that phase 4 preserves
// while replacing the implementation underneath with the combined analyzer.
//
// Run: npm test (from api-server/). No network, no Mongo.

import http from 'http'
import assert from 'assert'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { startOpenAIStub, stubDb } from './helpers/stub-openai'
import { toTranscript } from '../samples/lib'
import type { Sample } from '../samples/lib'
import { OCEAN_ITEMS } from '@bigfive-org/transcript-analyzer'

const { saved } = stubDb()

function loadSample(name: string): Sample {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', `${name}.json`), 'utf8'))
}

// Big Five: plus-keyed 4 / minus-keyed 2 -> every domain keyed 4.0 -> high (96 / 24)
function canned(sample: Sample) {
  const a = sample.exchanges.map(e => e.answer)
  const q = (i: number, n: number) => a[i].split(' ').slice(0, n).join(' ')
  const oceanAnswers: Record<string, number> = {}
  for (const item of OCEAN_ITEMS) oceanAnswers[String(item.id)] = item.keyed === 'minus' ? 2 : 4
  const sdt: Record<string, number> = {}; for (let i = 1; i <= 18; i++) sdt[String(i)] = 3
  const jdr: Record<string, number> = {}; for (let i = 1; i <= 35; i++) jdr[String(i)] = 3
  const ev = (quote: string) => ({ reasoning: 'Stated directly.', evidence: [quote] })
  return {
    ocean: {
      answers: oceanAnswers,
      domains: { O: ev(q(0, 6)), C: ev(q(1, 6)), E: ev(q(2, 6)), A: ev(q(3, 6)), N: ev(q(4, 6)) },
      employer_view: ['Curious', 'Organized', 'Steady']
    },
    sdt: { answers: sdt, scales: { autonomy: ev(q(5, 5)), competence: ev(q(1, 5)), relatedness: ev(q(2, 5)) }, employer_view: ['a', 'b', 'c'] },
    jdr: {
      answers: jdr,
      scales: { demands: ev(q(4, 5)), control: ev(q(1, 5)), manager_support: ev(q(6, 5)), peer_support: ev(q(2, 5)), relationships: ev(q(3, 5)), role: ev(q(1, 5)), change: ev(q(0, 5)) },
      sustainability: 'Fine.', employer_view: ['a', 'b', 'c']
    },
    spiral: {
      profile: { structure_oriented: 50, achievement_oriented: 60, people_oriented: 55, systems_oriented: 45,
        orientation_evidence: { structure_oriented: ev(q(1, 5)), achievement_oriented: ev(q(0, 5)), people_oriented: ev(q(3, 5)), systems_oriented: ev(q(0, 5)) },
        communication_style: 'Direct', culture_fit_indicators: [], internal_tags: [], summary: 'Balanced.' },
      employer_view: ['Results-minded', 'Collaborative', 'Adaptive']
    },
    confidence: 0.7
  }
}

async function main() {
  const openai = await startOpenAIStub()
  const { analyzeRouter } = require('../src/routes/analyze')
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/api/analyze', analyzeRouter)
  const server = http.createServer(app)
  const port = await new Promise<number>(resolve => { server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)) })
  const post = (body: any) => fetch(`http://127.0.0.1:${port}/api/analyze`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })

  // 1. A too-short transcript is a CLIENT error now (was a 500)
  {
    const res = await post({ transcript: 'word '.repeat(30).trim() + ' end of this very short transcript text.' })
    assert.equal(res.status, 400)
    assert.equal(openai.calls, 0)
    console.log('PASS /api/analyze: 400 on quality-gate failure (was 500)')
  }

  // 2. The old response shape, now backed by the combined analyzer
  {
    const sample = loadSample('rig-candidate')
    const transcript = toTranscript(sample)
    openai.setCanned(canned(sample))
    openai.resetCalls()
    saved.length = 0
    const res = await post({ transcript, language: 'en', jobRole: sample.role })
    assert.equal(res.status, 200)
    const body: any = await res.json()
    assert.equal(typeof body.id, 'string')
    assert.equal(body.confidence, 0.7)
    assert.deepEqual(body.scores, { O: 'high', C: 'high', E: 'high', A: 'high', N: 'high' })
    assert.equal(typeof body.contentQuality.score, 'string')
    assert.equal(openai.calls, 1)

    // The stored document: the REAL 120 keyed answers, not 30 faked from facets
    assert.equal(saved.length, 1)
    const doc = saved[0]
    assert.equal(doc.analysis.answers.length, 120)
    for (const a of doc.analysis.answers) {
      assert.ok(['O', 'C', 'E', 'A', 'N'].includes(a.domain))
      assert.ok(a.facet >= 1 && a.facet <= 6)
      assert.equal(a.score, 4, 'every answer keys to 4 in this fixture')
    }
    // The old scores shape, with real counts
    assert.equal(doc.analysis.scores.O.count, 24)
    assert.equal(doc.analysis.scores.O.score, 96)
    assert.equal(doc.analysis.scores.O.result, 'high')
    assert.equal(doc.analysis.scores.O.facet['1'].count, 4)
    assert.equal(doc.analysis.scores.O.facet['1'].score, 16)
    // Evidence in the website's shape: per domain, verbatim, domain name in facetName
    assert.equal(doc.analysis.evidence.length, 5)
    for (const e of doc.analysis.evidence) {
      assert.ok(transcript.includes(e.quote), `verbatim: ${e.quote}`)
      assert.equal(typeof e.facetName, 'string')
      assert.equal(e.facet, 0)
      assert.equal(typeof e.reasoning, 'string')
    }
    assert.ok(doc.analysis.reasoning.includes('Openness'))
    console.log('PASS /api/analyze: old shape preserved, 120 real answers stored')
  }

  server.close()
  openai.close()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
