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
import { PostgresRateLimitStore } from './postgresRateLimitStore.js'

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

/*
 * All limiters below share one Postgres-backed store (rate_limit_hits,
 * see middleware/postgresRateLimitStore.js) instead of express-rate-limit's
 * default in-memory store. In-memory counts are per-process — with 2+
 * Railway replicas (or a WORKER_MODE process) each instance would think it
 * alone owns the full quota, so the real ceiling silently becomes
 * (configured max) × (instance count). Each limiter gets its own `prefix`
 * so the same userId/IP key used by two different limiters never collides.
 */

/** Fallback for unauthenticated traffic and as a safety net on all routes. */
export const globalRateLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 15 * 60 * 1000,
  // Local React Query + Strict Mode burns through 300 quickly (incl. OPTIONS).
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  skip: (req) =>
    req.path.startsWith('/webhooks') || req.method === 'OPTIONS',
  store: new PostgresRateLimitStore({ prefix: 'global' }),
})

/**
 * Modest IP limit for webhook ingress (Plaid/Stripe/Clerk).
 * Global limiter skips /webhooks so signature verification can run; this
 * still bounds forged-JWT floods that burn outbound Plaid key fetches.
 */
export const webhookRateLimiter = rateLimit({
  ...rateLimitDefaults,
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 120 : 1000,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  store: new PostgresRateLimitStore({ prefix: 'webhook' }),
})

/**
 * Per-user (or per-IP when anonymous) limits for expensive endpoints.
 * windowMs + max are intentionally not echoed in JSON responses.
 */
export function createUserRateLimiter({ windowMs, max, prefix }) {
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
    store: new PostgresRateLimitStore({ prefix }),
  })
}

export const plaidRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  // Dev: Strict Mode + HMR + Clerk getToken churn burns a tight 30/hr quickly.
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  prefix: 'plaid',
})

export const syncRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  prefix: 'sync',
})

export const narrativeRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  prefix: 'narrative',
})

export const securityHeaders = createSecurityHeaders()
