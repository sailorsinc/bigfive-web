// A canned OpenAI chat.completions server for route tests — the ONE place the
// model is stood in for. It returns whatever `setCanned(payload)` was last
// given, as the assistant's JSON content, and counts calls. `setFailing(true)`
// makes every call answer HTTP 503 until switched off — the OpenAI SDK retries
// a 503, so one failure alone would never reach the MODEL_UNAVAILABLE path.
// No network.
//
// Usage:
//   const stub = await startOpenAIStub()   // sets OPENAI_API_KEY + OPENAI_BASE_URL
//   stub.setCanned(payload); stub.calls    // per test
//   stub.close()

import http from 'http'

export interface OpenAIStub {
  setCanned(payload: unknown): void
  setFailing(on: boolean): void
  readonly calls: number
  resetCalls(): void
  close(): void
}

export async function startOpenAIStub(): Promise<OpenAIStub> {
  let canned: unknown = null
  let calls = 0
  let failing = false

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      calls++
      if (failing) {
        res.statusCode = 503
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: { message: 'stub: service unavailable', type: 'server_error' } }))
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
    setFailing: on => { failing = on },
    get calls() { return calls },
    resetCalls: () => { calls = 0 },
    close: () => server.close()
  }
}

/**
 * Stub the db module through require.cache BEFORE any route is loaded.
 * Combined results are kept in memory by sitting id so the idempotent-replay
 * path is exercised for real. Returns the saved inputs.
 */
export function stubDb(): { saved: any[]; reset(): void } {
  const saved: any[] = []
  const bySitting = new Map<string, { id: string; input: any }>()
  let n = 0
  const nextId = () => `a1b2c3d4e5f6a7b8c9d0e1f${(n++).toString(16).padStart(1, '0')}`.slice(0, 24)
  const dbPath = require.resolve('../../src/db')
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      saveCombinedAnalysis: async (input: any) => {
        saved.push(input)
        const id = nextId()
        if (input.sitting?.id) bySitting.set(input.sitting.id, { id, input })
        return id
      },
      findCombinedBySittingId: async (sittingId: string) => {
        const hit = bySitting.get(sittingId)
        if (!hit) return null
        return { id: hit.id, analysis: hit.input.analysis, contentQuality: hit.input.contentQuality }
      },
      saveAnalysis: async (input: any) => { saved.push(input); return nextId() },
      getAnalysisById: async () => null,
      connectToDatabase: async () => { throw new Error('no db in tests') }
    }
  } as any
  return { saved, reset: () => { saved.length = 0; bySitting.clear() } }
}
