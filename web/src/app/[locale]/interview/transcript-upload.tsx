'use client'

import { useState } from 'react'
import { Button } from '@nextui-org/button'
import { Textarea } from '@nextui-org/input'
import { Card, CardBody, CardHeader } from '@nextui-org/card'
import { useRouter } from 'next/navigation'

export function TranscriptUpload() {
  const [transcript, setTranscript] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    if (transcript.trim().length < 100) {
      setError('Transcript is too short. Please provide at least 100 characters for accurate analysis.')
      return
    }

    setError('')
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.trim(),
          language: 'en'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()

      // Redirect to results page
      router.push(`/result/${data.id}`)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze transcript')
      setIsAnalyzing(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File is too large. Maximum size is 5MB.')
      return
    }

    try {
      const text = await file.text()
      setTranscript(text)
      setError('')
    } catch (err) {
      setError('Failed to read file. Please ensure it is a text file.')
    }
  }

  const exampleTranscript = `Interviewer: Tell me about a challenging project you worked on recently.

Candidate: Sure! I led the development of a new microservices architecture for our e-commerce platform. The biggest challenge was coordinating with five different teams and ensuring we maintained backward compatibility while modernizing the system.

Interviewer: How did you approach coordinating with multiple teams?

Candidate: I set up weekly sync meetings and created a shared documentation space. I believe in transparent communication, so I made sure everyone had visibility into our progress and blockers. When conflicts arose, I brought stakeholders together to find solutions that worked for everyone.

Interviewer: What was the outcome?

Candidate: We successfully migrated 80% of our services within six months, reduced latency by 40%, and the team felt really good about the collaborative process. I learned a lot about balancing technical excellence with people management.

Interviewer: How do you handle stress when deadlines are tight?

Candidate: I try to break down large tasks into smaller, manageable pieces. I also prioritize ruthlessly - not everything needs to be perfect on day one. When I feel overwhelmed, I take short breaks to clear my head. Exercise helps me a lot too.`

  const handleLoadExample = () => {
    setTranscript(exampleTranscript)
    setError('')
  }

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-2 pb-4">
        <div className="flex w-full justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold">Upload Transcript</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Paste your interview transcript or upload a text file
            </p>
          </div>
          <Button
            size="sm"
            variant="flat"
            color="primary"
            onPress={handleLoadExample}
          >
            Load Example
          </Button>
        </div>
      </CardHeader>

      <CardBody className="gap-4">
        <div>
          <Textarea
            label="Interview Transcript"
            placeholder="Paste the interview transcript here..."
            value={transcript}
            onValueChange={setTranscript}
            minRows={15}
            maxRows={25}
            className="w-full"
            description="Minimum 100 characters recommended for accurate analysis"
          />
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>{transcript.length} characters</span>
            {transcript.length > 0 && transcript.length < 100 && (
              <span className="text-warning">Need {100 - transcript.length} more characters</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block">
              <input
                type="file"
                accept=".txt,.md,.doc,.docx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100
                  dark:file:bg-primary-900 dark:file:text-primary-300
                  cursor-pointer"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: .txt, .md (max 5MB)
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-sm text-danger-700 dark:text-danger-400">{error}</p>
          </div>
        )}

        <Button
          color="primary"
          size="lg"
          onPress={handleAnalyze}
          isLoading={isAnalyzing}
          isDisabled={!transcript.trim() || transcript.trim().length < 100}
          className="w-full"
        >
          {isAnalyzing ? 'Analyzing Transcript...' : 'Analyze Personality'}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>💡 <strong>Tips for better results:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Include both interviewer questions and candidate responses</li>
            <li>Longer transcripts (500+ words) provide more accurate assessments</li>
            <li>Behavioral interview questions work best for personality analysis</li>
            <li>Technical-only interviews may have limited personality indicators</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  )
}
