import { Router } from 'express'
import { getAnalysisById } from '../db'

export const resultsRouter = Router()

resultsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { includeEvidence, includeTranscript } = req.query

    if (!id || id.length !== 24) {
      return res.status(400).json({
        error: 'Invalid ID format. Must be 24-character MongoDB ObjectId'
      })
    }

    const result = await getAnalysisById(id, {
      includeEvidence: includeEvidence === 'true',
      includeTranscript: includeTranscript === 'true'
    })

    if (!result) {
      return res.status(404).json({
        error: 'Analysis not found'
      })
    }

    res.json(result)

  } catch (error) {
    console.error('Results retrieval error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to retrieve results'
    })
  }
})
