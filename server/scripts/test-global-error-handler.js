/*
 * Verifies global error middleware catches Clerk getAuth() throws
 * (real @clerk/express middleware in the pipeline — not mocked).
 *
 * Usage:
 *   node scripts/test-global-error-handler.js before
 *   node scripts/test-global-error-handler.js after
 */

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import insightsRouter from '../routes/insights.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mode = process.argv[2] || 'before'
const withErrorHandler = mode === 'after'

function buildApp() {
  const app = express()
  app.use(express.json())

  // Same failure mode as test #3: insights router calls getAuth() but this
  // mount point never ran clerkMiddleware for the request.
  app.use('/api/insights', insightsRouter)

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
  console.log('GET /api/insights/usage (insights mounted before clerkMiddleware)')
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
