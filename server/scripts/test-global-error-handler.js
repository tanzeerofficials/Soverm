/*
 * Verifies global error middleware catches Clerk getAuth() throws
 * when a route runs without clerkMiddleware having authenticated the request.
 *
 * Why a minimal route (not insightsRouter): insights now uses requireAuth(),
 * which redirects unauthenticated requests instead of throwing — that would
 * never reach the error handler. getAuth() still throws without middleware.
 *
 * Historically this ran as `node scripts/test-global-error-handler.js before|after`
 * to compare pre/post-fix behavior; now that the fix is permanent, it always
 * exercises the current ("after") behavior as a regression test under node:test.
 */

import 'dotenv/config'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'

function buildApp() {
  const app = express()
  app.use(express.json())

  // Intentionally mounted before clerkMiddleware so getAuth() throws.
  app.get('/api/insights/usage', (req, res) => {
    const { userId } = getAuth(req)
    res.json({ userId })
  })

  app.use(
    clerkMiddleware({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    })
  )

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message)
    if (res.headersSent) {
      return next(err)
    }
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  })

  return app
}

test('global error handler returns generic JSON, not a stack trace', async () => {
  const app = buildApp()

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0)
    s.once('listening', () => resolve(s))
    s.once('error', reject)
  })

  try {
    const port = server.address().port
    const res = await fetch(`http://127.0.0.1:${port}/api/insights/usage`)
    const raw = await res.text()

    const isHtml = raw.trimStart().startsWith('<!DOCTYPE') || raw.includes('<html')
    const isGenericJson =
      res.headers.get('content-type')?.includes('application/json') &&
      raw.includes(GENERIC_ERROR_MESSAGE) &&
      !raw.includes('clerkMiddleware') &&
      !raw.includes('getAuth')

    assert.ok(
      isGenericJson && !isHtml,
      `Expected a generic JSON error body, got: ${raw.slice(0, 200)}`
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
