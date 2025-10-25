# @bigfive-org/transcript-analyzer

Analyze interview transcripts for Big Five (OCEAN) personality assessment using GPT-4.

## Installation

```bash
npm install @bigfive-org/transcript-analyzer
```

## Usage

```typescript
import { analyzeTranscript } from '@bigfive-org/transcript-analyzer'

const analysis = await analyzeTranscript({
  text: 'Your interview transcript here...',
  language: 'en',
  interviewType: 'behavioral',
  jobRole: 'Software Engineer',
  candidateName: 'John Doe'
})

console.log(analysis.scores)      // OCEAN scores compatible with @bigfive-org/score
console.log(analysis.evidence)    // Supporting quotes from transcript
console.log(analysis.confidence)  // Overall confidence (0-1)
console.log(analysis.reasoning)   // Summary of personality assessment
```

## Output Format

The `scores` object is compatible with `@bigfive-org/results` package:

```typescript
{
  scores: {
    O: { score: 24, count: 6, result: 'high', facet: {...} },
    C: { score: 21, count: 6, result: 'neutral', facet: {...} },
    E: { score: 18, count: 6, result: 'neutral', facet: {...} },
    A: { score: 22, count: 6, result: 'high', facet: {...} },
    N: { score: 15, count: 6, result: 'low', facet: {...} }
  },
  evidence: [
    {
      domain: 'O',
      facet: 5,
      facetName: 'Intellect',
      quote: 'I love diving into complex problems...',
      reasoning: 'Demonstrates high intellectual curiosity',
      confidence: 0.9
    }
  ],
  confidence: 0.82,
  reasoning: 'Strong analytical mindset with high openness...'
}
```

## Environment Variables

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=sk-...
```

## License

MIT
