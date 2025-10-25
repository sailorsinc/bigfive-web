import { Router } from 'express'
import { z } from 'zod'
import { analyzeTranscript, assessContentQuality } from '@bigfive-org/transcript-analyzer'
import { saveAnalysis } from '../db'

export const analyzeRouter = Router()

// Request validation schema
const AnalyzeRequestSchema = z.object({
  transcript: z.string().min(100, 'Transcript must be at least 100 characters'),
  language: z.string().optional().default('en'),
  jobRole: z.string().optional(),
  interviewType: z.enum(['behavioral', 'technical', 'mixed']).optional(),
  candidateName: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

analyzeRouter.post('/', async (req, res) => {
  try {
    // Validate request
    const validatedData = AnalyzeRequestSchema.parse(req.body)

    // Check content quality
    const quality = assessContentQuality(validatedData.transcript)

    if (quality.warnings.length > 0) {
      console.warn('Quality warnings:', quality.warnings)
    }

    // Analyze transcript
    const analysis = await analyzeTranscript({
      text: validatedData.transcript,
      language: validatedData.language,
      jobRole: validatedData.jobRole,
      interviewType: validatedData.interviewType,
      candidateName: validatedData.candidateName
    })

    // Save to database
    const resultId = await saveAnalysis({
      transcript: validatedData.transcript,
      language: validatedData.language,
      jobRole: validatedData.jobRole,
      interviewType: validatedData.interviewType,
      candidateName: validatedData.candidateName,
      analysis,
      metadata: validatedData.metadata
    })

    // Return response
    res.json({
      id: resultId,
      confidence: analysis.confidence,
      contentQuality: {
        score: quality.estimatedQuality,
        wordCount: quality.wordCount,
        warnings: quality.warnings,
        recommendations: quality.recommendations
      },
      scores: {
        O: analysis.scores.O.result,
        C: analysis.scores.C.result,
        E: analysis.scores.E.result,
        A: analysis.scores.A.result,
        N: analysis.scores.N.result
      },
      metadata: {
        tokensUsed: analysis.metadata.tokensUsed,
        processingTime: analysis.metadata.processingTime
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      })
    }

    console.error('Analysis error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed'
    })
  }
})

// Endpoint to check content quality without analyzing
analyzeRouter.post('/validate', (req, res) => {
  try {
    const { transcript } = req.body

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Transcript is required'
      })
    }

    const quality = assessContentQuality(transcript)

    res.json({
      quality: quality.estimatedQuality,
      wordCount: quality.wordCount,
      sentenceCount: quality.sentenceCount,
      speakerTurns: quality.speakerTurns,
      warnings: quality.warnings,
      recommendations: quality.recommendations,
      isReady: quality.estimatedQuality !== 'poor'
    })
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Validation failed'
    })
  }
})
