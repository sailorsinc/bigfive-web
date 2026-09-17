// A canned OpenAI chat.completions server for route tests — the ONE place the
// model is stood in for. It returns whatever `setCanned(payload)` was last
// given, as the assistant's JSON content, and counts calls. No network.
//
// Usage:
//   const stub = await startOpenAIStub()   // sets OPENAI_API_KEY + OPENAI_BASE_URL
//   stub.setCanned(payload); stub.calls    // per test
//   stub.close()

import http from 'http'

export interface OpenAIStub {
  setCanned(payload: unknown): void
  readonly calls: number
  resetCalls(): void
  close(): void
}

export async function startOpenAIStub(): Promise<OpenAIStub> {
  let canned: unknown = null
  let calls = 0

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      calls++
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
    get calls() { return calls },
    resetCalls: () => { calls = 0 },
    close: () => server.close()
  }
}

/** Stub the db module through require.cache BEFORE any route is loaded. Returns the saved docs. */
export function stubDb(): { saved: any[] } {
  const saved: any[] = []
  const dbPath = require.resolve('../../src/db')
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      saveCombinedAnalysis: async (input: any) => { saved.push(input); return 'a1b2c3d4e5f6a7b8c9d0e1f2' },
      saveAnalysis: async (input: any) => { saved.push(input); return 'a1b2c3d4e5f6a7b8c9d0e1f2' },
      getAnalysisById: async () => null,
      connectToDatabase: async () => { throw new Error('no db in tests') }
    }
  } as any
  return { saved }
}
