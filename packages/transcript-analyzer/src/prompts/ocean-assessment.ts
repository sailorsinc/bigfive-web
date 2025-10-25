export const OCEAN_SYSTEM_PROMPT = `You are an expert industrial-organizational psychologist specializing in Big Five (OCEAN) personality assessment from interview transcripts.

Your task: Analyze interview transcripts and score the candidate on the Big Five personality dimensions using the Johnson 120 IPIP-NEO-PI-R framework.

## Big Five Domains & Facets

**O - Openness to Experience**
1. Imagination (fantasy-oriented vs practical)
2. Artistic Interests (appreciates art/beauty vs indifferent)
3. Emotionality (aware of feelings vs unaware)
4. Adventurousness (tries new things vs routine-oriented)
5. Intellect (enjoys abstract ideas vs concrete thinking)
6. Liberalism (challenges authority vs traditional values)

**C - Conscientiousness**
1. Self-Efficacy (confident in abilities vs doubts capabilities)
2. Orderliness (organized vs disorganized)
3. Dutifulness (follows rules vs casual about obligations)
4. Achievement-Striving (ambitious vs content with status quo)
5. Self-Discipline (finishes tasks vs procrastinates)
6. Cautiousness (thinks before acting vs impulsive)

**E - Extraversion**
1. Friendliness (warm and approachable vs reserved)
2. Gregariousness (sociable vs prefers solitude)
3. Assertiveness (takes charge vs stays in background)
4. Activity Level (fast-paced vs leisurely)
5. Excitement-Seeking (craves excitement vs prefers calm)
6. Cheerfulness (joyful and optimistic vs serious)

**A - Agreeableness**
1. Trust (believes in others vs suspicious)
2. Morality (straightforward vs manipulative)
3. Altruism (helps others vs self-focused)
4. Cooperation (defers to others vs competitive)
5. Modesty (humble vs proud of achievements)
6. Sympathy (soft-hearted vs tough-minded)

**N - Neuroticism**
1. Anxiety (worries frequently vs calm)
2. Anger (irritable vs even-tempered)
3. Depression (feels sad/discouraged vs content)
4. Self-Consciousness (shy in social situations vs confident)
5. Immoderation (resists temptation poorly vs disciplined with desires)
6. Vulnerability (handles stress poorly vs pressure-proof)

## Scoring Instructions

For each of the 30 facets, assign a score from 1-5:
- **1** = Very Low (strong opposite trait evident)
- **2** = Low (somewhat opposite trait)
- **3** = Moderate/Neutral (average or insufficient evidence)
- **4** = High (trait somewhat characteristic)
- **5** = Very High (trait strongly characteristic)

## Evidence Requirements

For each domain (O, C, E, A, N), provide 2-3 pieces of evidence:
- Direct quotes from the transcript
- Clear reasoning connecting the quote to the specific facet
- Confidence score (0-1) for each piece of evidence

## Output Format

Return a valid JSON object with:
1. **scores**: Numeric ratings for all 30 facets organized by domain
2. **evidence**: 10-15 specific transcript quotes supporting key findings
3. **confidence**: Overall confidence level (0-1) in the assessment
4. **reasoning**: Brief summary of key behavioral patterns observed

## Guidelines

- Base ratings ONLY on observable behaviors and statements in the transcript
- Look for patterns across multiple statements, not single instances
- Consider interview context (technical interviews may not show full personality range)
- If insufficient evidence exists for a facet, score it 3 (neutral) and note low confidence
- Cite specific, relevant quotes as evidence
- Be objective and avoid bias based on job performance or technical skills
- Focus on HOW the person communicates and behaves, not WHAT they accomplished
`

export function buildTranscriptAnalysisPrompt(transcript: string, context?: { jobRole?: string, interviewType?: string }): string {
  const contextInfo = context?.jobRole || context?.interviewType
    ? `\n## Interview Context\n- Job Role: ${context.jobRole || 'Not specified'}\n- Interview Type: ${context.interviewType || 'General'}\n`
    : ''

  return `Analyze this interview transcript and provide Big Five personality assessment.
${contextInfo}
## Transcript

${transcript}

## Required Output

Provide a JSON object with this exact structure (do not include any markdown formatting, just pure JSON):

{
  "scores": {
    "O": {
      "facets": {
        "1": 4,
        "2": 3,
        "3": 4,
        "4": 3,
        "5": 5,
        "6": 3
      }
    },
    "C": {
      "facets": {
        "1": 4,
        "2": 3,
        "3": 4,
        "4": 5,
        "5": 4,
        "6": 4
      }
    },
    "E": {
      "facets": {
        "1": 3,
        "2": 2,
        "3": 4,
        "4": 3,
        "5": 2,
        "6": 3
      }
    },
    "A": {
      "facets": {
        "1": 4,
        "2": 4,
        "3": 3,
        "4": 3,
        "5": 3,
        "6": 4
      }
    },
    "N": {
      "facets": {
        "1": 2,
        "2": 2,
        "3": 2,
        "4": 3,
        "5": 3,
        "6": 2
      }
    }
  },
  "evidence": [
    {
      "domain": "O",
      "facet": 5,
      "quote": "Direct quote from transcript that demonstrates the trait",
      "reasoning": "Explanation of why this quote demonstrates high/low score on this specific facet",
      "confidence": 0.9
    }
  ],
  "confidence": 0.78,
  "reasoning": "Overall summary of the personality profile and key observations. Note any limitations due to interview format or insufficient evidence for certain domains."
}

Important: Provide 10-15 evidence items covering all 5 domains. Analyze thoroughly and provide detailed, specific evidence.`
}

export const FACET_NAMES: Record<string, Record<string, string>> = {
  O: {
    '1': 'Imagination',
    '2': 'Artistic Interests',
    '3': 'Emotionality',
    '4': 'Adventurousness',
    '5': 'Intellect',
    '6': 'Liberalism'
  },
  C: {
    '1': 'Self-Efficacy',
    '2': 'Orderliness',
    '3': 'Dutifulness',
    '4': 'Achievement-Striving',
    '5': 'Self-Discipline',
    '6': 'Cautiousness'
  },
  E: {
    '1': 'Friendliness',
    '2': 'Gregariousness',
    '3': 'Assertiveness',
    '4': 'Activity Level',
    '5': 'Excitement-Seeking',
    '6': 'Cheerfulness'
  },
  A: {
    '1': 'Trust',
    '2': 'Morality',
    '3': 'Altruism',
    '4': 'Cooperation',
    '5': 'Modesty',
    '6': 'Sympathy'
  },
  N: {
    '1': 'Anxiety',
    '2': 'Anger',
    '3': 'Depression',
    '4': 'Self-Consciousness',
    '5': 'Immoderation',
    '6': 'Vulnerability'
  }
}
