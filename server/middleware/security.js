/*
 * SECURITY MIDDLEWARE
 *
 * Helmet sets safe HTTP response headers. Rate limiters throttle abuse
 * without leaking internal threshold numbers to clients.
 *
 * CSP note:
 * - The React app (Vercel) has the real browser CSP — see client/src/lib/contentSecurityPolicy.js
 * - This API policy is intentionally strict (JSON only): default-src 'none'
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { getAuth } from '@clerk/express'
import { createSecurityHeaders } from '../utils/contentSecurityPolicy.js'

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
  // Local React Query + Strict Mode burns through 300 quickly (incl. OPTIONS).
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  skip: (req) =>
    req.path.startsWith('/webhooks') || req.method === 'OPTIONS',
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

export const securityHeaders = createSecurityHeaders()
