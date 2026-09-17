// A canned OpenAI chat.completions server for route tests — the ONE place the
// model is stood in for. It returns whatever `setCanned(payload)` was last
// given, as the assistant's JSON content, and counts calls. `setFailing(...)`
// makes every call answer a given HTTP status (+ error code) until switched
// off — the OpenAI SDK retries a 503, so one failure alone would never reach
// the MODEL_UNAVAILABLE path. `lastBody` is the request the route last sent.
// No network.
//
// Usage:
//   const stub = await startOpenAIStub()   // sets OPENAI_API_KEY + OPENAI_BASE_URL
//   stub.setCanned(payload); stub.calls    // per test
//   stub.close()

import http from 'http'

export interface OpenAIStub {
  setCanned(payload: unknown): void
  /** false to stop failing; a status (503, 401, 429 …) to fail every call with it; `code` goes into the error body. */
  setFailing(status: number | false, code?: string): void
  readonly calls: number
  readonly lastBody: any
  resetCalls(): void
  close(): void
}

export async function startOpenAIStub(): Promise<OpenAIStub> {
  let canned: unknown = null
  let calls = 0
  let failing: number | false = false
  let failCode: string | undefined
  let lastBody: any = null

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      calls++
      try { lastBody = JSON.parse(body) } catch { lastBody = null }
      if (failing) {
        res.statusCode = failing
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: { message: `stub: failing with ${failing}`, type: 'server_error', code: failCode ?? null } }))
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(canned) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 32, total_tokens: 42 },
        system_fingerprint: 'fp_stub'
      }))
    })
  })

  const port = await new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port))
  })
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`

  return {
    setCanned: p => { canned = p },
    setFailing: (status, code) => { failing = status; failCode = code },
    get calls() { return calls },
    get lastBody() { return lastBody },
    resetCalls: () => { calls = 0 },
    close: () => server.close()
  }
}

/**
 * Stub the db module through require.cache BEFORE any route is loaded.
 *
 * WHAT THIS IS AND IS NOT. It stands in for src/db.ts so the route can be
 * driven without Mongo: saves are recorded; combined results are kept by
 * (owner, sitting.id) so the route's replay branch runs; a second save for the
 * same key throws the duplicate-key error the real unique index would. It does
 * NOT exercise Mongo — the index itself, findOne, or the concurrent race — so a
 * passing replay test proves the ROUTE's logic, not the database's. (Owner
 * approved the canned-model pattern; this map is the minimum needed to reach
 * the replay and duplicate-key branches at all.)
 */
export function stubDb(): { saved: any[]; reset(): void } {
  const saved: any[] = []
  const byKey = new Map<string, { id: string; input: any }>()
  let n = 0
  const nextId = () => (n++).toString(16).padStart(24, '0')
  const key = (owner: string, sittingId: string) => `${owner}\u0000${sittingId}`
  const dbPath = require.resolve('../../src/db')
  class DuplicateSittingError extends Error {
    constructor(public readonly sittingId: string) { super(`dup ${sittingId}`); this.name = 'DuplicateSittingError' }
  }
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      DuplicateSittingError,
      saveCombinedAnalysis: async (input: any) => {
        const k = key(input.owner, input.sitting?.id)
        if (byKey.has(k)) throw new DuplicateSittingError(input.sitting.id)
        saved.push(input)
        const id = nextId()
        byKey.set(k, { id, input })
        return id
      },
      findCombinedBySittingId: async (owner: string, sittingId: string) => {
        const hit = byKey.get(key(owner, sittingId))
        if (!hit) return null
        return { id: hit.id, fingerprint: hit.input.fingerprint, analysis: hit.input.analysis, contentQuality: hit.input.contentQuality }
      },
      saveAnalysis: async (input: any) => { saved.push(input); return nextId() },
      getAnalysisById: async () => null,
      connectToDatabase: async () => { throw new Error('no db in tests') }
    }
  } as any
  return { saved, reset: () => { saved.length = 0; byKey.clear() } }
}
