import { Request, Response, NextFunction } from 'express'

export interface AuthRequest extends Request {
  apiKey?: string
  isAuthenticated: boolean
}

/**
 * API Key Authentication Middleware
 *
 * Supports two modes:
 * 1. With valid API key: Full access, higher rate limits
 * 2. Without API key (public): Limited access, strict rate limits
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string
  const validApiKeys = process.env.API_KEYS?.split(',') || []

  // If API keys are not configured, allow public access
  if (validApiKeys.length === 0 || validApiKeys[0] === '') {
    ;(req as AuthRequest).isAuthenticated = false
    return next()
  }

  // Check if provided API key is valid
  if (apiKey && validApiKeys.includes(apiKey)) {
    ;(req as AuthRequest).apiKey = apiKey
    ;(req as AuthRequest).isAuthenticated = true
    return next()
  }

  // If API keys are configured but none provided or invalid
  if (validApiKeys.length > 0 && validApiKeys[0] !== '') {
    // Allow public access without authentication
    ;(req as AuthRequest).isAuthenticated = false
    return next()
  }

  next()
}

/**
 * Require API Key Middleware
 * Use this for endpoints that MUST have authentication
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string
  const validApiKeys = process.env.API_KEYS?.split(',') || []

  if (validApiKeys.length === 0 || validApiKeys[0] === '') {
    return res.status(500).json({
      error: 'API authentication is not configured on this server'
    })
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key is required. Provide it via X-API-Key header or apiKey query parameter.'
    })
  }

  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key'
    })
  }

  ;(req as AuthRequest).apiKey = apiKey
  ;(req as AuthRequest).isAuthenticated = true
  next()
}

/**
 * Optional API Key Middleware
 * Records whether request is authenticated, but doesn't block unauthenticated requests
 */
export function optionalApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string
  const validApiKeys = process.env.API_KEYS?.split(',') || []

  if (apiKey && validApiKeys.includes(apiKey)) {
    ;(req as AuthRequest).apiKey = apiKey
    ;(req as AuthRequest).isAuthenticated = true
  } else {
    ;(req as AuthRequest).isAuthenticated = false
  }

  next()
}
