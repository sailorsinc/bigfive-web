# Railway Deployment Guide

Deploy the BigFive Interview Transcript Analysis API to Railway in minutes.

## Overview

This guide covers deploying the **standalone API server** to Railway. The API can be accessed from any application via REST endpoints.

## Prerequisites

1. [Railway account](https://railway.app/) (free tier available)
2. OpenAI API key with GPT-4 access
3. MongoDB database (Railway provides MongoDB add-on or use MongoDB Atlas)

## Deployment Options

### Option A: Deploy via Railway CLI (Recommended)

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login to Railway

```bash
railway login
```

#### Step 3: Initialize Project

```bash
cd /path/to/bigfive-web
railway init
```

Select:
- Create new project → Yes
- Project name → `bigfive-api`

#### Step 4: Add MongoDB

```bash
railway add
```

Select: **MongoDB**

Railway will provision a MongoDB instance and set `MONGO_URL` environment variable.

#### Step 5: Set Environment Variables

```bash
# Set OpenAI API key
railway variables set OPENAI_API_KEY=sk-your-actual-key

# Set MongoDB URI (if not auto-set)
railway variables set MONGODB_URI=${{MONGO_URL}}

# Set other configs
railway variables set DB_NAME=bigfive
railway variables set DB_COLLECTION=results
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set ALLOWED_ORIGINS=*
```

#### Step 6: Deploy

```bash
railway up
```

Railway will:
1. Build the Docker image
2. Deploy to production
3. Provide a public URL (e.g., `https://bigfive-api-production.up.railway.app`)

#### Step 7: Verify Deployment

```bash
# Check health
curl https://your-app.up.railway.app/health

# Expected response:
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

---

### Option B: Deploy via Railway Dashboard (Web UI)

#### Step 1: Create New Project

1. Go to [railway.app](https://railway.app/)
2. Click **New Project**
3. Select **Deploy from GitHub repo**

#### Step 2: Connect Repository

1. Authorize Railway to access your GitHub
2. Select the `bigfive-web` repository
3. Railway auto-detects Dockerfile

#### Step 3: Add MongoDB

1. Click **New** → **Database** → **MongoDB**
2. Railway provisions database and sets `MONGO_URL`

#### Step 4: Configure Environment Variables

Go to **Variables** tab and add:

```
OPENAI_API_KEY=sk-your-actual-key
MONGODB_URI=${{MONGO_URL}}
DB_NAME=bigfive
DB_COLLECTION=results
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=*
RATE_LIMIT_MAX=100
```

#### Step 5: Deploy

Railway automatically deploys on git push. Or click **Deploy** manually.

#### Step 6: Get Public URL

1. Go to **Settings** tab
2. Click **Generate Domain**
3. Railway provides: `https://your-app.up.railway.app`

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | ✅ Yes | OpenAI API key | `sk-...` |
| `MONGODB_URI` | ✅ Yes | MongoDB connection string | `mongodb://...` |
| `DB_NAME` | No | Database name | `bigfive` (default) |
| `DB_COLLECTION` | No | Collection name | `results` (default) |
| `PORT` | No | Server port | `3001` (default) |
| `NODE_ENV` | No | Environment | `production` |
| `ALLOWED_ORIGINS` | No | CORS origins | `*` or `https://app.com` |
| `RATE_LIMIT_MAX` | No | Max requests per 15min | `100` (default) |

---

## API Endpoints

Once deployed, your API will have these endpoints:

### 1. Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "openai": "configured",
    "mongodb": "connected"
  }
}
```

### 2. Analyze Transcript

```bash
POST /api/analyze
Content-Type: application/json

{
  "transcript": "Interviewer: Tell me about...\nCandidate: I worked on...",
  "language": "en",
  "jobRole": "Software Engineer",
  "interviewType": "behavioral"
}
```

**Response:**
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

### 3. Get Results

```bash
GET /api/results/:id?includeEvidence=true&includeTranscript=false
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "timestamp": 1705315800000,
  "scores": {
    "O": { "score": 24, "average": 4.0, "result": "high" },
    "C": { "score": 18, "average": 3.0, "result": "neutral" },
    ...
  },
  "confidence": 0.82,
  "evidence": [ /* if includeEvidence=true */ ],
  "transcript": "..." /* if includeTranscript=true */
}
```

### 4. Validate Transcript Quality

```bash
POST /api/analyze/validate
Content-Type: application/json

{
  "transcript": "Your transcript here..."
}
```

**Response:**
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

---

## Using MongoDB Atlas (Instead of Railway MongoDB)

If you prefer MongoDB Atlas:

1. Create cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Set in Railway:

```bash
railway variables set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/bigfive"
```

---

## Cost Estimation

### Railway Costs

**Free Tier:**
- $5 free credit/month
- 500 hours execution time
- Enough for development/testing

**Hobby Plan ($5/month):**
- 5GB RAM
- 5GB disk
- Unlimited execution time

### OpenAI Costs

Per transcript analysis (GPT-4-turbo):
- Short (500 words): ~$0.10-$0.20
- Medium (1500 words): ~$0.20-$0.40
- Long (3000 words): ~$0.40-$0.80

### MongoDB Costs

**Railway MongoDB:**
- Included in plan
- 1GB storage (Hobby plan)

**MongoDB Atlas:**
- Free tier: 512MB storage
- Paid: From $9/month (2GB)

---

## Scaling Considerations

### Auto-Scaling

Railway automatically scales based on:
- CPU usage
- Memory usage
- Request volume

Configure in `railway.toml`:

```toml
[deploy]
minReplicas = 1
maxReplicas = 10
```

### Rate Limiting

Built-in rate limiting:
- 100 requests per 15 minutes per IP (default)
- Configurable via `RATE_LIMIT_MAX`

For higher limits:

```bash
railway variables set RATE_LIMIT_MAX=1000
```

### Caching Results

Consider adding Redis for caching identical transcripts:

```bash
railway add redis
```

---

## Monitoring & Logs

### View Logs

```bash
railway logs
```

Or in Railway dashboard → **Logs** tab

### Metrics

Railway provides:
- CPU usage
- Memory usage
- Request count
- Response times

Access in **Metrics** tab

### Alerts

Set up alerts in **Settings** → **Alerts**:
- Health check failures
- High error rates
- Resource limits

---

## Security Best Practices

### 1. Restrict CORS Origins

```bash
railway variables set ALLOWED_ORIGINS="https://yourapp.com,https://api.yourapp.com"
```

### 2. Add API Key Authentication (Optional)

Edit `api-server/src/index.ts`:

```typescript
import { validateApiKey } from './middleware/auth'

app.use('/api', validateApiKey)
```

Create `src/middleware/auth.ts`:

```typescript
export function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const validKeys = process.env.API_KEYS?.split(',') || []

  if (!validKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  next()
}
```

Set keys:

```bash
railway variables set API_KEYS="key1,key2,key3"
```

### 3. Enable HTTPS Only

Railway provides HTTPS by default. Enforce it:

```typescript
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`)
  }
  next()
})
```

### 4. Sanitize Inputs

Already implemented via Zod validation in routes.

---

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**

Solution: Ensure `railway.json` uses correct Dockerfile path

### Health Check Fails

**Error: MongoDB not connected**

Solution:
1. Check `MONGODB_URI` is set
2. Verify MongoDB service is running
3. Check network connectivity

```bash
railway variables
railway logs
```

### High Latency

**Issue: Slow API responses**

Solutions:
1. Check OpenAI API status
2. Increase Railway plan (more RAM)
3. Add caching layer (Redis)
4. Optimize prompts (reduce tokens)

### Rate Limit Errors

**Error: "Too many requests"**

Solution: Increase rate limit or add API key tiers:

```bash
railway variables set RATE_LIMIT_MAX=500
```

---

## Continuous Deployment

### Auto-Deploy on Git Push

Railway auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Update API"
git push origin main
```

Railway detects changes and redeploys automatically.

### Manual Deploy

```bash
railway up
```

### Rollback

```bash
railway rollback
```

Or in dashboard: **Deployments** → Select version → **Rollback**

---

## Custom Domain (Optional)

### Add Custom Domain

1. Railway dashboard → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `api.yourdomain.com`
4. Add CNAME record to your DNS:

```
CNAME  api  your-app.up.railway.app
```

5. Railway auto-provisions SSL certificate

---

## API Client Examples

### cURL

```bash
curl -X POST https://your-app.up.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Interviewer: Tell me about a project...",
    "language": "en",
    "jobRole": "Software Engineer"
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('https://your-app.up.railway.app/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transcript: 'Interviewer: ...',
    language: 'en',
    jobRole: 'Software Engineer'
  })
})

const result = await response.json()
console.log(result.scores)
```

### Python

```python
import requests

response = requests.post(
    'https://your-app.up.railway.app/api/analyze',
    json={
        'transcript': 'Interviewer: ...',
        'language': 'en',
        'jobRole': 'Software Engineer'
    }
)

result = response.json()
print(result['scores'])
```

---

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test API endpoints
3. ⏭️ Add custom domain
4. ⏭️ Implement API key authentication
5. ⏭️ Set up monitoring/alerts
6. ⏭️ Create client SDKs (optional)

---

## Support

- Railway Docs: https://docs.railway.app/
- Railway Discord: https://discord.gg/railway
- OpenAI Status: https://status.openai.com/

For project-specific issues, check the logs:

```bash
railway logs --tail 100
```
