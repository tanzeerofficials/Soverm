/*
 * SECURITY MIDDLEWARE
 *
 * Helmet sets safe HTTP response headers. Rate limiters throttle abuse
 * without leaking internal threshold numbers to clients.
 */

import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { getAuth } from '@clerk/express'

const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.'

function rateLimitHandler(_req, res) {
  res.status(429).json({
    error: 'rate_limit_exceeded',
    message: RATE_LIMIT_MESSAGE,
  })
}

const rateLimitDefaults = {
  standardHeaders: false,
  legacyHeaders: false,
  handler: rateLimitHandler,
}

/** Fallback for unauthenticated traffic and as a safety net on all routes. */
export const globalRateLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: (req) => req.path.startsWith('/webhooks'),
})

/**
 * Per-user (or per-IP when anonymous) limits for expensive endpoints.
 * windowMs + max are intentionally not echoed in JSON responses.
 */
export function createUserRateLimiter({ windowMs, max }) {
  return rateLimit({
    ...rateLimitDefaults,
    windowMs,
    max,
    keyGenerator: (req) => {
      const { userId } = getAuth(req)
      if (userId) {
        return userId
      }
      return ipKeyGenerator(req.ip)
    },
  })
}

export const plaidRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
})

export const syncRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
})

export const narrativeRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
})

export const securityHeaders = helmet({
  contentSecurityPolicy: false,
})
