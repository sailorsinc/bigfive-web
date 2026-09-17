# BigFive Interview Transcript Analysis API

REST API for analyzing interview transcripts and generating OCEAN personality assessments.

## Base URL

```
Production: https://your-app.up.railway.app
Development: http://localhost:3001
```

---

## Authentication

Currently **no authentication** required (open API).

### Adding API Key Authentication (Optional)

To restrict access, add API key validation:

1. Set API keys in environment:
```bash
API_KEYS=key1-secret,key2-secret,key3-secret
```

2. Include in requests:
```bash
curl -H "X-API-Key: key1-secret" https://api.yourdomain.com/api/analyze
```

---

## Endpoints

### 1. Health Check

Check API status and dependencies.

**Request:**
```http
GET /health
```

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "openai": "configured",
    "mongodb": "connected"
  },
  "version": "1.0.0"
}
```

**Error Response:** `503 Service Unavailable`
```json
{
  "status": "unhealthy",
  "services": {
    "openai": "missing_api_key",
    "mongodb": "disconnected"
  }
}
```

---

### 2. Analyze Transcript

> **Since v1.3.0 this endpoint is a view over the combined four-framework analyzer** (one Big Five, design D4): the same 120-item IPIP sheet, the same verbatim-quote checks and retry, the same calculator. The response shape below is unchanged, with three honest differences: `scores.<domain>.count` is 24 and `scores.<domain>.facet.<n>.count` is 4 (real item counts, not the old "always 1"); the stored `answers` are the **120 keyed answers** the model gave as the candidate — the same shape a human sitting stores, so the website's result page scores them identically; and evidence is per domain (`facet: 0`, `facetName` = the domain name). An empty transcript returns **400**; there is no length floor — a short one is scored, and `contentQuality` says it was thin. `interviewType` is passed to the model as context (a technical interview is told to read absent evidence as "no evidence", never as a low score).

Analyze an interview transcript and generate OCEAN personality assessment.

**Request:**
```http
POST /api/analyze
Content-Type: application/json
```

**Request Body:**
```json
{
  "transcript": "string (required, min 100 chars)",
  "language": "string (optional, default: 'en')",
  "jobRole": "string (optional)",
  "interviewType": "behavioral | technical | mixed (optional)",
  "metadata": {
    "customField": "any (optional)"
  }
}
```

**Example:**
```json
{
  "transcript": "Interviewer: Tell me about a challenging project you worked on.\n\nCandidate: I led a team of 5 developers to migrate our legacy system to microservices. The biggest challenge was managing stakeholder expectations while maintaining quality. I organized weekly sync meetings and created detailed documentation to keep everyone aligned. When conflicts arose, I brought everyone together to discuss concerns openly.",
  "language": "en",
  "jobRole": "Software Engineer",
  "interviewType": "behavioral"
}
```

**Success Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "confidence": 0.82,
  "contentQuality": {
    "score": "good",
    "wordCount": 850,
    "warnings": [],
    "recommendations": []
  },
  "scores": {
    "O": "high",
    "C": "neutral",
    "E": "neutral",
    "A": "high",
    "N": "low"
  },
  "metadata": {
    "tokensUsed": 3450,
    "processingTime": 8500
  }
}
```

**OCEAN Scores:**
- `O` - Openness to Experience
- `C` - Conscientiousness
- `E` - Extraversion
- `A` - Agreeableness
- `N` - Neuroticism

**Score Values:**
- `low` - Score < 2.5 (average per facet)
- `neutral` - Score 2.5-3.5
- `high` - Score > 3.5

**Error Responses:**

`400 Bad Request` - Validation error
```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 100,
      "message": "Transcript must be at least 100 characters"
    }
  ]
}
```

`500 Internal Server Error` - Analysis failed
```json
{
  "error": "Failed to analyze transcript: OpenAI API error"
}
```

---

### 3. Validate Transcript Quality

Check transcript quality before analyzing (no GPT-4 call, instant response).

**Request:**
```http
POST /api/analyze/validate
Content-Type: application/json
```

**Request Body:**
```json
{
  "transcript": "string (required)"
}
```

**Success Response:** `200 OK`
```json
{
  "quality": "good",
  "wordCount": 850,
  "sentenceCount": 45,
  "speakerTurns": 12,
  "warnings": [],
  "recommendations": [],
  "isReady": true   // false only when there is nothing to score; `quality` carries the advice
}
```

**Quality Levels:**
- `poor` - < 200 words, thin evidence (still scored; expect neutrals and low coverage)
- `fair` - 200-500 words, limited evidence
- `good` - 500-1000 words, reliable
- `excellent` - 1000+ words, highly reliable

**With Warnings Example:**
```json
{
  "quality": "fair",
  "wordCount": 350,
  "sentenceCount": 20,
  "speakerTurns": 4,
  "warnings": [
    "Transcript is relatively short (under 500 words)",
    "Some personality facets may have insufficient evidence"
  ],
  "recommendations": [
    "Longer transcripts (1000+ words) provide more accurate results"
  ],
  "isReady": true
}
```

---

### 4. Get Analysis Results

Retrieve previously analyzed transcript results.

**Request:**
```http
GET /api/results/:id?includeEvidence=true&includeTranscript=false
```

**Parameters:**
- `id` (path) - MongoDB ObjectId (24-character hex string)
- `includeEvidence` (query) - Include evidence quotes (default: `false`)
- `includeTranscript` (query) - Include original transcript text (default: `false`)

**Example:**
```http
GET /api/results/507f1f77bcf86cd799439011?includeEvidence=true
```

**Success Response:** `200 OK`
```json
{
  "id": "507f1f77bcf86cd799439011",
  "timestamp": 1705315800000,
  "language": "en",
  "type": "transcript",
  "scores": {
    "O": {
      "score": 96,
      "count": 24,
      "average": 4.0,
      "result": "high"
    },
    "C": {
      "score": 18,
      "average": 3.0,
      "result": "neutral"
    },
    "E": {
      "score": 19,
      "average": 3.17,
      "result": "neutral"
    },
    "A": {
      "score": 23,
      "average": 3.83,
      "result": "high"
    },
    "N": {
      "score": 15,
      "average": 2.5,
      "result": "low"
    }
  },
  "confidence": 0.82,
  "reasoning": "Strong analytical mindset with high openness to new ideas...",
  "evidence": [
    {
      "domain": "O",
      "facet": 5,
      "facetName": "Intellect",
      "quote": "I love diving into complex problems and thinking about scalability",
      "reasoning": "Demonstrates high intellectual curiosity and abstract thinking",
      "confidence": 0.9
    }
  ],
  "transcriptInfo": {
    "length": 850,
    "jobRole": "Software Engineer",
    "interviewType": "behavioral",
  },
  "analysisMetadata": {
    "model": "gpt-4-turbo-preview",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "tokensUsed": 3450,
    "processingTime": 8500,
    "contentQuality": "good",
    "contentQualityScore": 78
  }
}
```

**Error Responses:**

`400 Bad Request` - Invalid ID
```json
{
  "error": "Invalid ID format. Must be 24-character MongoDB ObjectId"
}
```

`404 Not Found` - Result not found
```json
{
  "error": "Analysis not found"
}
```

---

### 5. Combined Four-Framework Analysis — contract 2

Score one interview across **four** frameworks in one model call: Big Five (OCEAN),
Self-Determination Theory (SDT), Job Demands-Resources (JD-R), and Spiral Dynamics.
Same authentication and rate limits as `/api/analyze`. Deterministic: temperature 0.1 +
a content-hash seed.

**The model is a stand-in respondent, never a judge.** For Big Five, SDT and JD-R it
fills in a fixed item sheet *as the candidate* from what they said; the server does the
arithmetic. Every quote is verbatim from a candidate **answer** and tagged with the
exchange it came from — a phrase that appears only in an interviewer question is rejected.

| Framework | Sheet the model fills in | Scored as |
|---|---|---|
| OCEAN | the 120 Johnson IPIP-NEO items from the published `@bigfive-org/questions` package (`ipip-neo-120`; public domain) | minus-keyed items reversed → sum per domain (24 items) and per facet (4) → average → `low` (< 2.5) / `neutral` / `high` (> 3.5); `percent` = (average−1)/4×100 |
| SDT | 18 items, byall's own wording on the W-BNS three-need structure (`byall-sdt-needs-v1`; the W-BNS items are research-only licensed and not used) | same arithmetic, 3 scales; `dominant_drivers` = the two highest, computed |
| JD-R | the 35 HSE Management Standards Indicator Tool items (`hse-msit-v1`; Crown copyright, Open Government Licence) | same arithmetic, 7 scales |
| Spiral | four orientations 0-100 (`byall-spiral-rubric-v1` — no open validated Spiral instrument exists; this is byall's own rubric) | validated server-side; `dominant_orientation` / `secondary_orientation` = the two highest, computed |

**Cut-offs note:** the published `@bigfive-org/score` default the *website* uses is > 3 / < 3. This API uses the fork's intended 2.5 / 3.5 — a wider neutral band, so an item answered 3 for lack of evidence can't tip a facet to high on one stray 4.

**Privacy:** Spiral vMEME colour labels appear **only** inside `spiral.profile`. Every employer-facing string is checked twice (analyzer retry + response layer). The scorer holds **no names** — `candidateName` is refused — and stores the **result only**, never the exchanges' text.

**Idempotent, per caller:** the key is (caller, `sitting.id`) — the caller being a hash of the API key, or `public` without one — and it is enforced by a unique index in the database, so a retry racing the first request cannot store a second result. The same sitting from the same caller returns the same result and `id`, with `meta.replayed: true`, and makes no second model call. The same `sitting.id` with **different answers** is refused with `409 SITTING_CONFLICT`: an id names one interview. Use an API key to get your own idempotency scope.

**Request:**
```http
POST /api/analyze-combined
Content-Type: application/json
X-API-Key: your-key (optional, same as /api/analyze)
```

```json
{
  "contract": "2",
  "sitting": { "id": "sit_8f3a2c", "language": "en", "role": "Backend engineer" },
  "exchanges": [
    { "n": 1, "question": "Tell me about a problem you'd never seen before…", "answer": "A problem I'd never seen? I mapped the whole system out first…", "themes": ["openness"] },
    { "n": 2, "question": "…", "answer": "…", "themes": ["conscientiousness"] }
  ]
}
```

`sitting.role` is optional. `themes` are byall's eight interview themes (`openness`, `conscientiousness`, `extraversion`, `agreeableness`, `emotional stability`, `motivation`, `energy`, `values`) and feed `coverage.*.targeted`. Unknown top-level fields, `candidateName`, and the pre-contract-2 `transcript` string are refused with `INVALID_REQUEST`.

**Success Response:** `200 OK`
```json
{
  "contract": "2",
  "id": "65a4f8b2c3d4e5f6a7b8c9d0",
  "sitting": { "id": "sit_8f3a2c", "language": "en", "role": "Backend engineer" },
  "coverage": {
    "exchanges": 8, "unanswered": 0, "words": 390,
    "ocean":  { "targeted": 5, "quotes": 5, "neutral_items": 38, "confidence": 0.82 },
    "sdt":    { "targeted": 1, "quotes": 3, "neutral_items": 9,  "confidence": 0.55 },
    "jdr":    { "targeted": 1, "quotes": 7, "neutral_items": 16, "confidence": 0.60 },
    "spiral": { "targeted": 1, "quotes": 4, "neutral_items": 0,  "confidence": 0.58 }
  },
  "confidence": 0.78,
  "contentQuality": "good",
  "frameworks": {
    "ocean": {
      "instrument": "ipip-neo-120",
      "profile": {
        "O": {
          "name": "Openness To Experience",
          "score": 88, "count": 24, "average": 3.67, "percent": 67, "level": "high",
          "reasoning": "Curious, reads widely, tries new approaches before settling.",
          "evidence": [ { "text": "read everything I could find", "exchange": 1 } ],
          "facets": {
            "1": { "name": "Imagination", "score": 14, "count": 4, "average": 3.5, "percent": 63, "level": "neutral" },
            "...": "..."
          }
        },
        "C": { "...": "..." }, "E": { "...": "..." }, "A": { "...": "..." }, "N": { "...": "..." }
      },
      "answers": { "1": 4, "2": 2, "...": "...", "120": 3 },
      "headline": "Curious and quick to get to grips with the unfamiliar",
      "employer_view": ["Curious and quick to get to grips with the unfamiliar", "Keeps commitments visible", "Steady under pressure"]
    },
    "sdt": {
      "instrument": "byall-sdt-needs-v1",
      "profile": {
        "autonomy":    { "name": "Autonomy",    "score": 24, "count": 6, "average": 4.0, "percent": 75, "level": "high",    "reasoning": "...", "evidence": [ { "text": "Nobody was watching over my shoulder", "exchange": 6 } ] },
        "competence":  { "...": "..." },
        "relatedness": { "...": "..." }
      },
      "dominant_drivers": ["autonomy", "competence"],
      "answers": { "1": 4, "...": "...", "18": 3 },
      "headline": "…", "employer_view": ["…"]
    },
    "jdr": {
      "instrument": "hse-msit-v1",
      "profile": {
        "demands": { "name": "Demands", "...": "..." }, "control": { "...": "..." }, "manager_support": { "...": "..." },
        "peer_support": { "...": "..." }, "relationships": { "...": "..." }, "role": { "...": "..." }, "change": { "...": "..." }
      },
      "sustainability": "Sustainable with variety and a team to think with.",
      "answers": { "1": 4, "...": "...", "35": 3 },
      "headline": "…", "employer_view": ["…"]
    },
    "spiral": {
      "instrument": "byall-spiral-rubric-v1",
      "profile": {
        "orientations": {
          "structure_oriented":   { "score": 45, "reasoning": "...", "evidence": [ { "text": "…", "exchange": 8 } ] },
          "achievement_oriented": { "score": 72, "...": "..." }, "people_oriented": { "...": "..." }, "systems_oriented": { "...": "..." }
        },
        "dominant_orientation": "achievement_oriented", "secondary_orientation": "people_oriented",
        "communication_style": "…", "culture_fit_indicators": ["…"], "internal_tags": ["…"], "summary": "…"
      },
      "headline": "Results-oriented with a collaborative streak",
      "employer_view": ["…"]
    }
  },
  "meta": { "model": "gpt-4o", "attempts": 1, "tokens": 6120, "ms": 8400, "quotes_dropped": 0, "spiral_lines_scrubbed": 0, "seed": 482913, "replayed": false }
}
```

**Field notes:**
- For the three sheet frameworks `profile` is exactly the map of scales; `instrument`, `answers`, `headline`, `employer_view` and the extras (`dominant_drivers`, `sustainability`) sit beside it. Spiral's `profile` is internal-only — do not display it to employers.
- `*.evidence[]` — `{ text, exchange }`: `text` is verbatim in exchange `n`'s **answer**. The model is retried once on a violation; leftovers are dropped and counted in `meta.quotes_dropped`.
- `headline` is the first employer line — the one to show.
- `coverage.exchanges` counts exchanges with a non-blank answer — what the model actually saw; `unanswered` those sent without one. Only answered exchanges count as targeting a framework.
- `coverage.<framework>` — `targeted`: exchanges whose themes aimed at it; `quotes`: quotes that survived; `neutral_items`: sheet items answered 3 (no evidence); `confidence`: the model's confidence for that framework. A report can say "assessed lightly".
- `answers` — the raw 1-5 answers as given (not reversed), kept so a result is auditable and re-scorable.

**Errors** — every error carries a `code` and a `retry` flag:

| Status | `code` | `retry` | Meaning |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | false | not contract 2 (v1 transcript string, `candidateName`, schema) — `details` when from the schema |
| 400 | `TRANSCRIPT_TOO_SHORT` | false | nothing to score — no exchange with a non-blank answer. There is no numeric floor: a short sitting is scored and `coverage` says how thin it was |
| 409 | `SITTING_CONFLICT` | false | this `sitting.id` was already scored by this caller with different answers |
| 422 | `TRANSCRIPT_TOO_LONG` | false | the interview exceeds the model's context in one call |
| 500 | `MODEL_AUTH` | false | the scorer's model credentials were refused — a configuration fault |
| 503 | `MODEL_QUOTA` | false | the scorer's model account is out of quota — needs a human |
| 502 | `MODEL_REJECTED` | false | the model rejected this request for another reason (`message` says why) |
| 502 | `MODEL_UNAVAILABLE` | true | the model could not be reached, timed out, rate-limited us, or answered nothing |
| 502 | `CONTRACT_VIOLATION` | true | the model would not produce a valid sheet after one corrective retry |
| 500 | `INTERNAL` | false | anything else |

```json
{ "code": "TRANSCRIPT_TOO_SHORT", "retry": false, "message": "Nothing to score: no exchange has an answer." }
```

`GET /api/results/:id` returns a combined document with `contract`, `sitting`, `coverage`, `frameworks`, `confidence`, `contentQuality`, `analysisMetadata`, `transcriptInfo`. For `transcript`-type documents `scores.<domain>` now carries `count`: 24 for results scored on the 120-item sheet (score 24-120), 6 for documents from before it (score 6-30). `average` and `result` are comparable across both.

---

## Rate Limiting

Default limits:
- **100 requests per 15 minutes** per IP address
- Applies to all endpoints

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705316400
```

**Error Response:** `429 Too Many Requests`
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid API key |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Something went wrong |
| 503 | Service Unavailable - Dependencies down |

---

## Data Models

### TranscriptAnalysisRequest

```typescript
{
  transcript: string        // Min 100 chars, recommend 500+
  language?: string         // ISO 639-1 code (default: 'en')
  jobRole?: string          // E.g., "Software Engineer"
  interviewType?: 'behavioral' | 'technical' | 'mixed'
  metadata?: object         // Custom fields
}
```

### OceanScores

```typescript
{
  O: 'low' | 'neutral' | 'high'  // Openness
  C: 'low' | 'neutral' | 'high'  // Conscientiousness
  E: 'low' | 'neutral' | 'high'  // Extraversion
  A: 'low' | 'neutral' | 'high'  // Agreeableness
  N: 'low' | 'neutral' | 'high'  // Neuroticism
}
```

### Evidence

```typescript
{
  domain: 'O' | 'C' | 'E' | 'A' | 'N'
  facet: number              // 1-6
  facetName: string          // E.g., "Intellect"
  quote: string              // From transcript
  reasoning: string          // Why this supports the score
  confidence: number         // 0-1
}
```

---

## Client Examples

### JavaScript/TypeScript

```typescript
async function analyzeInterview(transcript: string) {
  const response = await fetch('https://api.yourdomain.com/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      language: 'en',
      jobRole: 'Software Engineer',
      interviewType: 'behavioral'
    })
  })

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`)
  }

  const result = await response.json()
  console.log('Personality Profile:', result.scores)
  console.log('Confidence:', result.confidence)

  return result
}
```

### Python

```python
import requests

def analyze_interview(transcript: str):
    response = requests.post(
        'https://api.yourdomain.com/api/analyze',
        json={
            'transcript': transcript,
            'language': 'en',
            'jobRole': 'Software Engineer',
            'interviewType': 'behavioral'
        }
    )

    response.raise_for_status()
    result = response.json()

    print('Personality Profile:', result['scores'])
    print('Confidence:', result['confidence'])

    return result
```

### cURL

```bash
curl -X POST https://api.yourdomain.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Interviewer: Tell me about yourself...",
    "language": "en",
    "jobRole": "Software Engineer",
    "interviewType": "behavioral"
  }'
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type AnalyzeRequest struct {
    Transcript    string `json:"transcript"`
    Language      string `json:"language"`
    JobRole       string `json:"jobRole"`
    InterviewType string `json:"interviewType"`
}

type AnalyzeResponse struct {
    ID         string            `json:"id"`
    Confidence float64           `json:"confidence"`
    Scores     map[string]string `json:"scores"`
}

func analyzeInterview(transcript string) (*AnalyzeResponse, error) {
    req := AnalyzeRequest{
        Transcript:    transcript,
        Language:      "en",
        JobRole:       "Software Engineer",
        InterviewType: "behavioral",
    }

    body, _ := json.Marshal(req)
    resp, err := http.Post(
        "https://api.yourdomain.com/api/analyze",
        "application/json",
        bytes.NewBuffer(body),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result AnalyzeResponse
    json.NewDecoder(resp.Body).Decode(&result)

    return &result, nil
}
```

---

## Best Practices

### 1. Content Quality

✅ **Do:**
- Use 500+ word transcripts
- Include behavioral questions
- Include both Q&A
- Use complete sentences

❌ **Don't:**
- Submit < 100 characters
- Use pure technical interviews
- Submit bullet points only
- Use yes/no answers only

### 2. Error Handling

```typescript
try {
  const result = await analyzeInterview(transcript)

  // Check confidence
  if (result.confidence < 0.6) {
    console.warn('Low confidence - transcript may be too short')
  }

  // Check quality warnings
  if (result.contentQuality.warnings.length > 0) {
    console.log('Quality issues:', result.contentQuality.warnings)
  }

} catch (error) {
  if (error.status === 429) {
    // Rate limited - retry later
    await sleep(60000)
    return analyzeInterview(transcript)
  }
  throw error
}
```

### 3. Performance

- **Validate first:** Use `/api/analyze/validate` before analyzing
- **Cache results:** Store analysis ID and reuse
- **Batch processing:** Analyze during off-peak hours
- **Monitor costs:** Track OpenAI token usage

---

## Webhook Support (Future)

Coming soon: Webhook notifications when analysis completes.

```json
POST /api/analyze
{
  "transcript": "...",
  "webhookUrl": "https://yourapp.com/webhook"
}
```

Will send:
```json
POST https://yourapp.com/webhook
{
  "id": "507f...",
  "status": "completed",
  "scores": { ... }
}
```

---

## SDK Support (Planned)

Official SDKs coming:
- JavaScript/TypeScript NPM package
- Python PyPI package
- Go module
- Ruby gem

---

## Support

- Documentation: https://docs.yourdomain.com
- API Status: https://status.yourdomain.com
- Issues: https://github.com/youruser/bigfive-web/issues

---

## Changelog

### v2.0.1 (2026-09-17) — review fixes
- Idempotency is scoped per caller (hash of the API key / `public`), enforced by a unique index; a reused `sitting.id` with different answers is `409 SITTING_CONFLICT`.
- Errors carry `retry`; model failures are classified: `MODEL_AUTH` 500, `MODEL_QUOTA` 503, `TRANSCRIPT_TOO_LONG` 422, `MODEL_REJECTED` 502 (all non-retryable) vs `MODEL_UNAVAILABLE` / `CONTRACT_VIOLATION` 502 (retryable).
- `coverage.exchanges` counts only answered exchanges; `coverage.unanswered` added. `null` from the model for an optional field means "nothing here", not a contract violation. Employer lines are trimmed and blank-free; `headline` is always the first line.
- `/api/analyze`: `interviewType` reaches the model again; `/api/analyze/validate`'s `isReady` matches the (floorless) gate; `GET /api/results` transcript scores carry `count`.

### v2.0.0 (2026-09-17) — contract 2, breaking for `/api/analyze-combined`
- **No length floor** on either endpoint (owner decision): only an empty transcript / no answered exchange is refused. A short sitting is scored; thinness is reported in `coverage` and `contentQuality`, never hidden behind a refusal. byall's own wrap floor was removed in the same release.
- Request is `{ contract: "2", sitting: { id, language, role? }, exchanges: [{ n, question, answer, themes }] }`. The v1 `transcript` string and `candidateName` are refused (`INVALID_REQUEST`).
- Every quote is verbatim from a candidate **answer** and carries its `exchange`; a phrase found only in a question is rejected. `evidence` is `[{ text, exchange }]` (was `string[]`).
- New: `coverage` per framework, `headline` per framework, per-framework `confidence` from the model, `meta`, typed error `code`s, idempotency on `sitting.id` (`meta.replayed`). `sitting` is echoed and stored; no name is ever stored.
- byall's contract-2 scorer is built against `api-server/samples/recorded/rig-candidate.contract2.json`, recorded by the tripwire test.

### v1.3.0 (2026-09-17)
- `POST /api/analyze` (and the website's `analyze-transcript` route): now a **view over the combined analyzer** — the older separate Big Five implementation (no quote check, no retry, untestable) is deleted. Response shape preserved; stored `answers` are the real 120 keyed answers; quality-gate failures return 400.
- `POST /api/analyze-combined`: **Big Five is now a sheet too** — the model answers the 120 Johnson IPIP-NEO items from the published `@bigfive-org/questions` package as the candidate; the server scores per domain (24 items) and per facet (4) with the one sheet calculator. Domain and facet names come from `@bigfive-org/results`. `ocean.profile.<domain>` gains `name`, `count`, `percent`, `facets`; `score` is now the 24-item sum (24-120, was 6-30). `ocean.answers` (120) is stored. For SDT and JD-R `profile` is now exactly the map of scales, with `instrument`, `answers` and extras beside it. `percent` added to every scale.

### v1.2.0 (2026-09-16)
- `POST /api/analyze-combined`: SDT and JD-R are now scored as **sheets** the model fills in as the candidate (18 SDT items on the W-BNS structure with byall's own wording; the 35 HSE Management Standards items for JD-R), with the same sum → average → cut-off arithmetic as OCEAN. Every scale carries `reasoning` + verbatim `evidence`, enforced like OCEAN's. Spiral orientations are validated and carry evidence. The pre-sheet `jdr.profile.demands` / `.resources` 0-100 pair is removed (JD-R is its seven scales, like OCEAN is its five domains). "Dominant" labels in SDT and Spiral are computed from the scores. One level vocabulary everywhere: `low` / `neutral` / `high`. Each framework profile carries an `instrument` label.

### v1.1.0 (2026-07-04)
- Added `POST /api/analyze-combined` — four-framework assessment (OCEAN + SDT + JD-R + Spiral Dynamics) in a single GPT call, with per-framework `profile` / `employer_view` split
- Server-side contract enforcement: verbatim OCEAN evidence substrings and a Spiral color-label scrub on `employer_view` (retry once, then sanitize)
- Combined results stored transcript-free (result only) and retrievable via `GET /api/results/:id`
- Existing endpoints (`/api/analyze`, `/api/analyze/validate`, `/api/results/:id`), auth, and rate limits unchanged

### v1.0.0 (2024-01-15)
- Initial API release
- OCEAN personality analysis
- Content quality validation
- Evidence extraction
- Rate limiting
