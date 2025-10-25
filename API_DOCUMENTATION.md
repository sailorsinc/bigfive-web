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
  "candidateName": "string (optional)",
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
  "isReady": true
}
```

**Quality Levels:**
- `poor` - < 200 words, unreliable results
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
      "score": 24,
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
    "candidateName": "John Doe"
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
  candidateName?: string    // Optional identifier
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

### v1.0.0 (2024-01-15)
- Initial API release
- OCEAN personality analysis
- Content quality validation
- Evidence extraction
- Rate limiting
