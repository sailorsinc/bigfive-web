# Quick Start Guide: Interview Transcript Analysis

## What's Been Built

Your BigFive-Web application now has **interview transcript analysis** capabilities!

Upload an interview transcript → Get OCEAN personality assessment with AI-powered evidence.

## What You Need

1. **OpenAI API Key** - Get one at https://platform.openai.com/api-keys
   - Requires GPT-4 access (GPT-4-turbo recommended)
   - Cost: ~$0.10-$0.40 per transcript analysis

2. **MongoDB** - Already configured in your project

## Setup (3 Steps)

### Step 1: Add OpenAI API Key

Create or edit `web/.env.local`:

```bash
# Add this line
OPENAI_API_KEY=sk-your-actual-api-key-here

# Your existing MongoDB config should already be here
MONGODB_URI=your-mongodb-connection-string
DB_COLLECTION=results
```

### Step 2: Start the Development Server

```bash
cd web
npm run dev
```

### Step 3: Test It Out

1. Open http://localhost:3000/interview
2. Click "Load Example" to populate with sample transcript
3. Click "Analyze Personality"
4. Wait 10-30 seconds for GPT-4 analysis
5. View results with OCEAN scores + evidence!

## What You'll See

### Upload Page (`/interview`)
- Paste transcript or upload file
- Minimum 100 characters
- Example transcript included
- Real-time validation

### Results Page (`/result/[id]`)
- **Same OCEAN visualization** you already have
- **NEW: Evidence Section** showing:
  - Direct quotes from transcript
  - AI reasoning for each trait
  - Confidence scores
  - Filter by personality domain (O/C/E/A/N)

## Testing with Your Own Transcripts

### Good Transcript Example:

```
Interviewer: Tell me about a challenging project you worked on.

Candidate: I led a team of 5 developers to migrate our legacy system
to microservices. The biggest challenge was managing stakeholder
expectations while maintaining quality. I organized weekly sync
meetings and created detailed documentation to keep everyone aligned.

Interviewer: How did you handle disagreements within the team?

Candidate: I believe in open communication. When conflicts arose,
I brought everyone together to discuss concerns openly. I tried to
understand each perspective before making decisions. Sometimes I had
to make tough calls, but I always explained my reasoning clearly.

[Continue with more Q&A...]
```

### Tips:
- Include both interviewer questions AND candidate answers
- 500+ words recommended for best results
- Behavioral questions work better than pure technical ones
- More content = more accurate personality assessment

## API Usage (Optional)

You can also call the API directly:

```bash
curl -X POST http://localhost:3000/api/analyze-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Your full interview transcript here...",
    "language": "en",
    "jobRole": "Software Engineer",
    "interviewType": "behavioral"
  }'
```

Response:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "confidence": 0.82,
  "evidenceCount": 12
}
```

## Architecture Overview

### What's New:

1. **`packages/transcript-analyzer/`**
   - GPT-4 integration for OCEAN analysis
   - Prompt engineering for personality assessment
   - Evidence extraction with confidence scores

2. **`/interview` route**
   - Transcript upload UI
   - File upload support
   - Validation and error handling

3. **`/api/analyze-transcript` endpoint**
   - Receives transcript
   - Calls GPT-4
   - Saves to MongoDB
   - Returns result ID

4. **Evidence display on results page**
   - Only shows for transcript-based assessments
   - Quotes + AI reasoning
   - Confidence metrics
   - Domain filtering

### What Stayed the Same:

✅ All existing functionality works unchanged
✅ Regular 120-question test still works
✅ Results visualization unchanged
✅ Database structure backward compatible
✅ Multi-language support intact

## Cost Monitoring

Each analysis costs approximately:
- Short (500 words): ~$0.10-$0.20
- Medium (1500 words): ~$0.20-$0.40
- Long (3000 words): ~$0.40-$0.80

Monitor your usage at: https://platform.openai.com/usage

## Troubleshooting

### "Service configuration error"
→ Check that `OPENAI_API_KEY` is set in `web/.env.local`

### "Transcript is too short"
→ Need minimum 100 characters (recommend 500+ words)

### Analysis takes forever
→ Normal: 10-30 seconds for GPT-4
→ Check OpenAI API status if longer

### No evidence showing on results
→ Make sure you're viewing a transcript result (uploaded via `/interview`)
→ Regular test results won't have evidence section

## Next Steps

Read the full documentation: [INTERVIEW_TRANSCRIPT_SETUP.md](./INTERVIEW_TRANSCRIPT_SETUP.md)

### Future Enhancements You Could Add:

1. **Audio transcription** - Add Whisper API integration
2. **Batch processing** - Analyze multiple transcripts at once
3. **Candidate comparison** - Side-by-side personality comparisons
4. **Custom competencies** - Add job-specific traits beyond OCEAN
5. **Streaming responses** - Real-time analysis updates

## Summary

You now have a complete interview transcript → OCEAN analysis system:

✅ Upload transcripts (paste or file)
✅ GPT-4 analyzes personality traits
✅ View OCEAN scores with evidence
✅ AI explanations for all scores
✅ Confidence metrics included
✅ Same beautiful UI you already have

**Total new code:** ~800 lines
**Changes to existing code:** Minimal (just added evidence display)
**Time to first analysis:** 3 minutes (add API key + start server)

Enjoy! 🚀
