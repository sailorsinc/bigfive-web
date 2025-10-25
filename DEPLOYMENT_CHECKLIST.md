# Railway Deployment Checklist

Use this checklist to deploy your API to Railway.

## Pre-Deployment

- [ ] OpenAI API key ready (`sk-...`)
- [ ] GitHub repository created
- [ ] Railway account created
- [ ] Code pushed to GitHub

## Railway Setup

- [ ] Create new Railway project
- [ ] Connect to GitHub repository
- [ ] Add MongoDB database (Railway plugin or Atlas)
- [ ] Generate public domain

## Environment Variables

Set these in Railway → Variables:

- [ ] `OPENAI_API_KEY` = `sk-your-actual-key`
- [ ] `MONGODB_URI` = `${{MONGO_URL}}` or MongoDB Atlas URL
- [ ] `DB_COLLECTION` = `results`
- [ ] `PORT` = `3001`
- [ ] `NODE_ENV` = `production`
- [ ] `ALLOWED_ORIGINS` = `*` (or specific domains)
- [ ] `RATE_LIMIT_MAX` = `100`

## Deployment

- [ ] Railway auto-deploys from GitHub
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Check deployment status (green checkmark)
- [ ] Copy public URL

## Testing

- [ ] **Health check**: `curl https://your-app.up.railway.app/health`
  - Should return `{"status": "healthy"}`

- [ ] **Validate endpoint**:
  ```bash
  curl -X POST https://your-app.up.railway.app/api/analyze/validate \
    -H "Content-Type: application/json" \
    -d '{"transcript": "Test transcript with at least 100 characters to meet the minimum requirement for validation testing purposes."}'
  ```
  - Should return quality metrics

- [ ] **Analyze endpoint**:
  ```bash
  curl -X POST https://your-app.up.railway.app/api/analyze \
    -H "Content-Type: application/json" \
    -d '{
      "transcript": "Interviewer: Tell me about yourself.\n\nCandidate: I am a software engineer with 5 years of experience. I love working on complex problems and collaborating with teams. In my last role, I led a project that reduced system latency by 40% through careful optimization and refactoring. I enjoy mentoring junior developers and I am always eager to learn new technologies.",
      "language": "en",
      "jobRole": "Software Engineer"
    }'
  ```
  - Should return analysis with ID and scores

- [ ] **Get results**:
  ```bash
  curl https://your-app.up.railway.app/api/results/YOUR_ID_HERE?includeEvidence=true
  ```
  - Should return full analysis with evidence

## Monitoring

- [ ] Check Railway logs (Logs tab)
- [ ] Check Railway metrics (CPU, RAM)
- [ ] Set up alerts (Settings → Alerts)
- [ ] Monitor OpenAI usage (platform.openai.com/usage)

## Optional Enhancements

- [ ] Add custom domain (Settings → Domains)
- [ ] Add API key authentication
- [ ] Set up monitoring/alerting
- [ ] Configure auto-scaling
- [ ] Add Redis for caching
- [ ] Create client SDK

## Documentation

- [ ] Update API base URL in docs
- [ ] Share API documentation with team
- [ ] Create example requests for your use case
- [ ] Document any custom configurations

## Security Review

- [ ] CORS origins configured correctly
- [ ] Rate limiting enabled
- [ ] Environment variables secured
- [ ] MongoDB access restricted
- [ ] HTTPS enforced (Railway default)
- [ ] Health check working
- [ ] Error messages don't leak secrets

## Cost Management

- [ ] Review Railway plan (Free → Hobby if needed)
- [ ] Set OpenAI spending limits
- [ ] Monitor token usage
- [ ] Set up budget alerts
- [ ] Review MongoDB storage limits

## Success Criteria

- [ ] Health endpoint returns 200
- [ ] Can analyze transcripts successfully
- [ ] Can retrieve results by ID
- [ ] Response times < 30 seconds
- [ ] No errors in logs
- [ ] All tests passing

## Rollback Plan

If something goes wrong:

- [ ] Railway → Deployments → Select previous version → Rollback
- [ ] Or: `railway rollback` (CLI)
- [ ] Check logs for errors
- [ ] Verify environment variables
- [ ] Test locally first before redeploying

## Support Resources

- [ ] Bookmark: [Railway Docs](https://docs.railway.app/)
- [ ] Bookmark: [OpenAI Status](https://status.openai.com/)
- [ ] Bookmark: [API Documentation](./API_DOCUMENTATION.md)
- [ ] Join Railway Discord for help

---

## Quick Reference

**Health Check:**
```bash
curl https://your-app.up.railway.app/health
```

**Analyze Transcript:**
```bash
curl -X POST https://your-app.up.railway.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"transcript": "YOUR_TRANSCRIPT_HERE"}'
```

**View Logs:**
```bash
railway logs --tail 100
```

**Update Environment Variable:**
```bash
railway variables set KEY=VALUE
```

---

## After Deployment

1. ✅ API is live and accessible
2. ✅ Share URL with your team
3. ✅ Integrate with your applications
4. ✅ Monitor usage and costs
5. ✅ Iterate and improve

**Congratulations! Your API is deployed! 🎉**
