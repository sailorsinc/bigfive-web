# Simple Railway Deployment (No Docker!)

Deploy directly from GitHub in 5 minutes - no Docker needed!

## Why No Docker?

Railway can deploy Node.js apps directly from GitHub using **Nixpacks** - it's simpler and faster!

- ✅ Automatic dependency installation
- ✅ Automatic build process
- ✅ No Dockerfile needed
- ✅ Deploy on every git push

---

## Quick Start (3 Steps)

### Step 1: Push to GitHub

```bash
cd /path/to/bigfive-web
git add .
git commit -m "Add API server"
git push origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app/)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose `bigfive-web` repository
5. Railway auto-detects it's a Node.js app ✅

### Step 3: Add Environment Variables

In Railway dashboard → **Variables** tab:

```
OPENAI_API_KEY=sk-your-actual-key-here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bigfive
DB_COLLECTION=results
PORT=3001
NODE_ENV=production
```

**Done!** Railway will:
1. Install dependencies
2. Build the packages
3. Start the API server
4. Give you a URL: `https://your-app.up.railway.app`

---

## Add MongoDB (Option A: Railway Plugin)

**Easiest way:**

1. In your Railway project, click **New**
2. Select **Database** → **MongoDB**
3. Railway provisions MongoDB instantly
4. Automatically sets `MONGO_URL` variable

Then update variables:

```
MONGODB_URI=${{MONGO_URL}}
```

---

## Add MongoDB (Option B: MongoDB Atlas)

**For production use:**

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Get connection string
4. Add to Railway variables:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bigfive
```

---

## How Railway Detects Your App

Railway reads `nixpacks.toml` (I created this for you):

```toml
[phases.setup]
nixPkgs = ["nodejs-20_x"]

[phases.install]
cmds = [
  "cd packages/transcript-analyzer && npm ci",
  "cd api-server && npm ci"
]

[phases.build]
cmds = [
  "cd packages/transcript-analyzer && npm run build",
  "cd api-server && npm run build"
]

[start]
cmd = "cd api-server && node dist/index.js"
```

This tells Railway:
1. Use Node.js 20
2. Install dependencies for both packages
3. Build TypeScript → JavaScript
4. Start the API server

---

## Test Your Deployed API

Once deployed, Railway gives you a URL. Test it:

```bash
# Health check
curl https://your-app.up.railway.app/health

# Analyze transcript
curl -X POST https://your-app.up.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Interviewer: Tell me about yourself.\n\nCandidate: I am a software engineer with 5 years of experience. I love working on complex problems and collaborating with teams. In my last role, I led a project that reduced system latency by 40% through careful optimization and refactoring.",
    "language": "en",
    "jobRole": "Software Engineer"
  }'
```

---

## Auto-Deploy on Git Push

Railway watches your GitHub repo. Every time you push:

```bash
git add .
git commit -m "Update API"
git push origin main
```

Railway automatically:
1. Detects changes
2. Rebuilds
3. Redeploys
4. Zero downtime!

---

## View Logs

In Railway dashboard:
- **Deployments** tab → See build progress
- **Logs** tab → See runtime logs
- **Metrics** tab → CPU/RAM usage

Or use Railway CLI:

```bash
npm install -g @railway/cli
railway login
railway logs
```

---

## Custom Domain

1. Railway → **Settings** → **Domains**
2. Click **Custom Domain**
3. Enter: `api.yourdomain.com`
4. Add CNAME to your DNS:

```
CNAME  api  your-app.up.railway.app
```

5. SSL auto-provisioned ✅

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | - | Your OpenAI API key |
| `MONGODB_URI` | ✅ Yes | - | MongoDB connection string |
| `DB_COLLECTION` | No | `results` | Collection name |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `ALLOWED_ORIGINS` | No | `*` | CORS origins (comma-separated) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per 15 min |

---

## Cost

**Free Tier:**
- $5 credit/month
- Enough for testing

**Hobby ($5/month):**
- Unlimited execution time
- 8GB RAM
- 100GB network

**Plus API costs:**
- OpenAI: ~$0.10-$0.40 per transcript
- MongoDB Atlas: Free tier available

---

## Troubleshooting

### Build fails

Check **Deployments** → Click failed build → See error

Common fixes:
- Missing environment variables
- TypeScript errors
- Dependency issues

### Health check fails

```bash
railway logs --tail 100
```

Check:
- Is `OPENAI_API_KEY` set?
- Is `MONGODB_URI` correct?
- Are dependencies installed?

### Slow responses

- Check OpenAI API status
- Upgrade Railway plan (more RAM)
- Check MongoDB connection

---

## What About Docker?

You can still use Docker if you want:
- Multi-stage builds
- Custom base images
- Specific OS requirements

But for this Node.js API, **Nixpacks is simpler**!

Docker is optional - I included both options:
- `Dockerfile` → If you want Docker
- `nixpacks.toml` → Simpler, Railway-native

Railway will auto-detect `nixpacks.toml` first.

---

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Connect Railway to repo
3. ✅ Add environment variables
4. ✅ Add MongoDB
5. ✅ Deploy!
6. ⏭️ Test API endpoints
7. ⏭️ Add custom domain (optional)
8. ⏭️ Set up monitoring

---

## Summary

**No Docker needed!** Railway deploys your Node.js app directly from GitHub using Nixpacks.

- Faster builds
- Simpler configuration
- Auto-deploy on git push
- Built-in health checks

Just push to GitHub and let Railway handle the rest!
