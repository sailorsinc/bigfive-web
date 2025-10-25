import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { analyzeRouter } from './routes/analyze'
import { resultsRouter } from './routes/results'
import { healthRouter } from './routes/health'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/health', healthRouter)
app.use('/api/analyze', analyzeRouter)
app.use('/api/results', resultsRouter)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BigFive Interview Transcript Analysis API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      analyze: 'POST /api/analyze',
      results: 'GET /api/results/:id',
      docs: '/api/docs'
    },
    documentation: 'https://github.com/yourusername/bigfive-web#api-documentation'
  })
})

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  })
})

app.listen(PORT, () => {
  console.log(`🚀 BigFive API Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🔬 Analyze endpoint: http://localhost:${PORT}/api/analyze`)
})

export default app
