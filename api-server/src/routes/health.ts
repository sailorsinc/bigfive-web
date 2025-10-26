import { Router } from 'express'
import { connectToDatabase } from '../db'

export const healthRouter = Router()

healthRouter.get('/', (req, res) => {
  // Simple health check - just verify server is running
  // Don't check external services during health check to avoid delays
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: hasOpenAIKey ? 'configured' : 'missing_api_key',
      mongodb: 'not_checked_in_health_endpoint'
    },
    version: '1.0.0'
  })
})
