# Interview Transcript Analysis Setup

This guide will help you set up the interview transcript analysis feature for BigFive personality assessment.

## Overview

The system analyzes interview transcripts using GPT-4 to generate OCEAN (Big Five) personality assessments with evidence-based explanations.

## Prerequisites

1. Node.js 18+ installed
2. MongoDB database (existing)
3. OpenAI API key with GPT-4 access

## Installation Steps

### 1. Install Package Dependencies

```bash
# Install dependencies for the transcript-analyzer package
cd packages/transcript-analyzer
npm install

# Build the package
npm run build

# Return to root
cd ../..

# Install the package in the web app
cd web
npm install ../packages/transcript-analyzer
cd ..
```

### 2. Set Environment Variables

Add to your `.env` or `.env.local` file:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Existing MongoDB config (should already be set)
MONGODB_URI=your-mongodb-connection-string
DB_COLLECTION=results
```

### 3. Verify Installation

```bash
# From the web directory
cd web
npm run dev
```

Visit these URLs:
- Upload page: `http://localhost:3000/interview`
- Test with existing result: `http://localhost:3000/result/[existing-id]`

## Usage

### 1. Upload Interview Transcript

Navigate to `/interview` in your browser:
- Paste transcript text (minimum 100 characters)
- Or upload a .txt file
- Click "Analyze Personality"

### 2. View Results

After analysis completes (10-30 seconds), you'll be redirected to the results page showing:
- OCEAN personality scores (same visualization as regular test)
- All 5 domains and 30 facets
- **New:** Evidence section with:
  - Direct quotes from transcript
  - AI reasoning for each score
  - Confidence metrics
  - Filterable by domain

### 3. API Endpoint

You can also use the API directly:

```bash
curl -X POST http://localhost:3000/api/analyze-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Your interview transcript here...",
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

Then view results at: `/result/{id}`

## Architecture

### New Components

1. **`packages/transcript-analyzer/`** - GPT-4 analysis engine
   - Analyzes transcripts for OCEAN traits
   - Extracts evidence quotes
   - Calculates confidence scores

2. **`web/src/app/[locale]/interview/`** - Upload interface
   - Transcript input (paste or file upload)
   - Example transcript loader
   - Validation and error handling

3. **`web/src/app/api/analyze-transcript/`** - API endpoint
   - Receives transcript
   - Calls GPT-4 analyzer
   - Saves to MongoDB with evidence
   - Returns result ID

4. **`web/src/components/evidence-section.tsx`** - Evidence display
   - Shows quotes from transcript
   - AI reasoning for scores
   - Filter by personality domain
   - Confidence indicators

### Data Storage

Results are stored in the same MongoDB collection as regular tests, with additional fields:

```typescript
{
  // Existing fields (compatible)
  answers: [...],        // Converted from OCEAN scores
  dateStamp: 1234567890,
  lang: "en",

  // New transcript-specific fields
  type: "transcript",
  transcript: {
    text: "Full transcript...",
    jobRole: "Software Engineer",
    interviewType: "behavioral"
  },
  analysis: {
    evidence: [
      {
        domain: "O",
        facet: 5,
        facetName: "Intellect",
        quote: "I love solving complex problems...",
        reasoning: "Shows intellectual curiosity",
        confidence: 0.9
      }
    ],
    confidence: 0.82,
    reasoning: "Overall assessment summary..."
  }
}
```

## Cost Considerations

### GPT-4 API Costs

Each transcript analysis costs approximately:
- Short transcript (500 words): ~$0.10 - $0.20
- Medium transcript (1500 words): ~$0.20 - $0.40
- Long transcript (3000 words): ~$0.40 - $0.80

Based on GPT-4-turbo pricing (as of 2024):
- Input: $10 per 1M tokens
- Output: $30 per 1M tokens

### Optimization Tips

1. Use `gpt-4-turbo-preview` (cheaper than `gpt-4`)
2. Consider caching results for identical transcripts
3. Set transcript length limits (e.g., 5000 words max)
4. Use rate limiting for public deployments

## Customization

### Adjust Scoring Prompts

Edit `packages/transcript-analyzer/src/prompts/ocean-assessment.ts` to:
- Modify facet definitions
- Change scoring criteria
- Add industry-specific guidelines
- Adjust evidence requirements

### Modify UI

- Upload page: `web/src/app/[locale]/interview/transcript-upload.tsx`
- Evidence display: `web/src/components/evidence-section.tsx`
- Results page: `web/src/app/[locale]/result/[id]/page.tsx`

## Troubleshooting

### "OpenAI API configuration error"

- Verify `OPENAI_API_KEY` is set in `.env.local`
- Check API key has GPT-4 access
- Ensure key starts with `sk-`

### "Transcript is too short"

- Minimum 100 characters required
- Recommend 500+ words for accurate analysis
- Include both questions and answers

### Analysis takes too long

- Expected: 10-30 seconds for GPT-4
- Check OpenAI API status
- Consider using streaming responses (future enhancement)

### Results not showing evidence

- Verify `type: "transcript"` is set in database
- Check that `analysis.evidence` array exists
- Ensure you're viewing a transcript-based result (not regular test)

## Future Enhancements

Potential improvements:

1. **Audio/Video Upload** - Integrate Whisper API for transcription
2. **Streaming Responses** - Show analysis progress in real-time
3. **Comparison View** - Compare multiple candidates side-by-side
4. **Custom Competencies** - Add job-specific assessment dimensions
5. **Batch Processing** - Analyze multiple transcripts at once
6. **Fine-tuned Models** - Train custom models on interview data

## Support

For issues or questions:
1. Check this documentation
2. Review existing codebase documentation
3. Check OpenAI API status
4. Open an issue on the repository

## License

Same as parent project (MIT)
