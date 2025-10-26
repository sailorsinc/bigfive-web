import { Router } from 'express'
import { connectToDatabase } from '../db'

export const healthRouter = Router()

healthRouter.get('/', async (req, res) => {
  try {
    // Check OpenAI API key
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY

    // Check MongoDB connection
    let mongoConnected = false
    try {
      await connectToDatabase()
      mongoConnected = true
    } catch (error) {
      console.error('MongoDB health check failed:', error)
    }

    // Server is healthy if it's running and has OpenAI key
    // MongoDB connection is checked but doesn't affect health status
    // (it may take time to connect or may be temporarily unavailable)
    const isHealthy = hasOpenAIKey

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        openai: hasOpenAIKey ? 'configured' : 'missing_api_key',
        mongodb: mongoConnected ? 'connected' : 'disconnected'
      },
      version: '1.0.0'
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
