export interface ContentQualityMetrics {
  wordCount: number
  sentenceCount: number
  speakerTurns: number
  hasQuestions: boolean
  hasResponses: boolean
  estimatedQuality: 'poor' | 'fair' | 'good' | 'excellent'
  warnings: string[]
  recommendations: string[]
}

export function assessContentQuality(transcript: string): ContentQualityMetrics {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Basic metrics
  const words = transcript.trim().split(/\s+/)
  const wordCount = words.length
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const sentenceCount = sentences.length

  // Detect speaker turns (common patterns)
  const speakerPatterns = [
    /interviewer:/gi,
    /candidate:/gi,
    /question:/gi,
    /answer:/gi,
    /^[A-Z][a-z]+:/gm  // Name: pattern
  ]

  let speakerTurns = 0
  speakerPatterns.forEach(pattern => {
    const matches = transcript.match(pattern)
    if (matches) speakerTurns += matches.length
  })

  // Check for questions and responses
  const hasQuestions = /\?/g.test(transcript) || /tell me|describe|what|how|why|when|where/gi.test(transcript)
  const hasResponses = speakerTurns > 2 || sentenceCount > 10

  // Quality assessment
  let estimatedQuality: 'poor' | 'fair' | 'good' | 'excellent'

  if (wordCount < 200) {
    estimatedQuality = 'poor'
    warnings.push('Transcript is very short (under 200 words)')
    warnings.push('Many personality facets will have low confidence scores')
    recommendations.push('Provide at least 500 words for reliable assessment')
    recommendations.push('Include multiple behavioral questions and detailed answers')
  } else if (wordCount < 500) {
    estimatedQuality = 'fair'
    warnings.push('Transcript is relatively short (under 500 words)')
    warnings.push('Some personality facets may have insufficient evidence')
    recommendations.push('Longer transcripts (1000+ words) provide more accurate results')
  } else if (wordCount < 1000) {
    estimatedQuality = 'good'
    if (speakerTurns < 5) {
      warnings.push('Few speaker turns detected - consider including more Q&A exchanges')
    }
  } else {
    estimatedQuality = 'excellent'
  }

  // Check for interview structure
  if (!hasQuestions) {
    warnings.push('No questions detected - is this a complete interview transcript?')
    recommendations.push('Include interviewer questions for better context')
  }

  if (speakerTurns < 3) {
    warnings.push('Limited dialogue structure detected')
    recommendations.push('Include both interviewer questions and candidate responses')
  }

  // Check for behavioral indicators
  const behavioralIndicators = [
    /\bI\b/gi,  // First-person pronouns
    /\bwe\b/gi,
    /\bteam\b/gi,
    /\bproject\b/gi,
    /\bchallenge\b/gi,
    /\bproblem\b/gi,
    /\bsolution\b/gi
  ]

  let indicatorCount = 0
  behavioralIndicators.forEach(pattern => {
    if (pattern.test(transcript)) indicatorCount++
  })

  if (indicatorCount < 3 && wordCount > 200) {
    warnings.push('Limited behavioral content detected')
    recommendations.push('Behavioral interview questions reveal more personality traits')
  }

  return {
    wordCount,
    sentenceCount,
    speakerTurns,
    hasQuestions,
    hasResponses,
    estimatedQuality,
    warnings,
    recommendations
  }
}

export function shouldProceedWithAnalysis(quality: ContentQualityMetrics): {
  proceed: boolean
  reason?: string
} {
  // Allow analysis but warn user
  if (quality.wordCount < 100) {
    return {
      proceed: false,
      reason: 'Transcript too short. Minimum 100 words required for any meaningful analysis.'
    }
  }

  // Proceed with warnings
  return { proceed: true }
}

export function getQualityScore(quality: ContentQualityMetrics): number {
  // Return 0-100 score
  const wordScore = Math.min(100, (quality.wordCount / 1000) * 100)
  const structureScore = quality.speakerTurns >= 5 ? 100 : (quality.speakerTurns / 5) * 100
  const contentScore = (quality.hasQuestions && quality.hasResponses) ? 100 : 50

  return Math.round((wordScore * 0.5 + structureScore * 0.3 + contentScore * 0.2))
}
