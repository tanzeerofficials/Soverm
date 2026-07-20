/*
 * Verifies global error middleware catches Clerk getAuth() throws
 * when a route runs without clerkMiddleware having authenticated the request.
 *
 * Usage:
 *   node scripts/test-global-error-handler.js before
 *   node scripts/test-global-error-handler.js after
 *
 * Why a minimal route (not insightsRouter): insights now uses requireAuth(),
 * which redirects unauthenticated requests instead of throwing — that would
 * never reach the error handler. getAuth() still throws without middleware.
 */

import 'dotenv/config'
import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'

const mode = process.argv[2] || 'before'
const withErrorHandler = mode === 'after'

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

  if (withErrorHandler) {
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err.message)
      if (res.headersSent) {
        return next(err)
      }
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    })
  }

  return app
}

const app = buildApp()
const server = app.listen(0, async () => {
  const port = server.address().port
  const res = await fetch(`http://127.0.0.1:${port}/api/insights/usage`)
  const raw = await res.text()
  const isHtml = raw.trimStart().startsWith('<!DOCTYPE') || raw.includes('<html')
  const isGenericJson =
    res.headers.get('content-type')?.includes('application/json') &&
    raw.includes(GENERIC_ERROR_MESSAGE) &&
    !raw.includes('clerkMiddleware') &&
    !raw.includes('getAuth')

  console.log(`Mode: ${mode} (error handler ${withErrorHandler ? 'ON' : 'OFF'})`)
  console.log('GET /api/insights/usage (route mounted before clerkMiddleware)')
  console.log('HTTP status:', res.status)
  console.log('Content-Type:', res.headers.get('content-type'))
  console.log('Body preview:', raw.slice(0, 200).replace(/\n/g, ' '))
  console.log('Is HTML error page:', isHtml)
  console.log('Is generic JSON:', isGenericJson)

  server.close()

  if (mode === 'before') {
    process.exit(isHtml ? 0 : 1)
  }
  process.exit(isGenericJson && !isHtml ? 0 : 1)
})
