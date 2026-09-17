import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/db'
import { analyzeTranscript } from '@bigfive-org/transcript-analyzer'

const collectionName = process.env.DB_COLLECTION || 'results'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, language = 'en', jobRole, interviewType } = body

    // Validate input
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string' },
        { status: 400 }
      )
    }

    if (transcript.trim().length < 100) {
      return NextResponse.json(
        { error: 'Transcript is too short. Please provide at least 100 characters.' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set')
      return NextResponse.json(
        { error: 'Service configuration error. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Analyze transcript using GPT-4
    const analysis = await analyzeTranscript({
      text: transcript,
      language,
      jobRole,
      interviewType
    }, apiKey)

    // The 120 keyed answers the model gave as the candidate — the same shape a
    // human sitting stores, so the result page scores them the same way.
    const answers = analysis.answers

    // Save to database with additional transcript metadata
    const db = await connectToDatabase()
    const collection = db.collection(collectionName)

    const result = await collection.insertOne({
      // Original format for compatibility
      answers,
      dateStamp: Date.now(),
      lang: language,

      // New transcript-specific fields
      type: 'transcript',
      transcript: {
        text: transcript,
        jobRole,
        interviewType,
        length: transcript.length
      },

      // Analysis metadata
      analysis: {
        evidence: analysis.evidence,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        metadata: analysis.metadata
      }
    })

    return NextResponse.json({
      id: result.insertedId.toString(),
      confidence: analysis.confidence,
      evidenceCount: analysis.evidence.length
    })

  } catch (error) {
    console.error('Transcript analysis error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API configuration error' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: `Analysis failed: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred during analysis' },
      { status: 500 }
    )
  }
}
