/*
 * SERVER START FILE (index.js)
 *
 * Think of this file as the "front door" of our app on the server.
 * When someone (or our React website) wants to talk to our backend,
 * this file decides who is allowed in, what path they can visit,
 * and which helper files handle each job.
 *
 * Big picture:
 * - Frontend (React) lives in the browser
 * - Backend (this file + routes) lives on the server
 * - Database stores users and bank accounts
 * - Clerk handles login
 * - Plaid handles bank connections
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// __dirname tells us "where is this file on the computer?"
// We need that so we can always find the .env file, even if
// the server is started from a different folder.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// dotenv reads secret settings from the .env file and puts them
// into process.env so the rest of the app can use them safely.
dotenv.config({ path: path.join(__dirname, '.env') })

const { Sentry, captureServerError, initSentry } = await import('./utils/sentry.js')
const sentryEnabled = initSentry()
if (process.env.NODE_ENV !== 'production') {
  console.info(
    sentryEnabled
      ? '[Sentry] enabled'
      : '[Sentry] disabled — add SENTRY_DSN to server/.env, then restart the server'
  )
}

let db

try {
  const dbModule = await import('./db/index.js')
  db = dbModule.pool ?? dbModule.default
  console.log('Database pool initialized')
} catch (error) {
  console.error('Failed to initialize database module:', error)
  process.exit(1)
}

const { default: cors } = await import('cors')
const { default: express } = await import('express')
const { clerkMiddleware, requireAuth } = await import('@clerk/express')
const { default: healthRoutes } = await import('./routes/health.js')
const { default: webhooksRouter } = await import('./routes/webhooks.js')
const { default: stripeWebhooksRouter } = await import('./routes/stripeWebhooks.js')
const { default: plaidRouter } = await import('./routes/plaid.js')
const { default: insightsRouter } = await import('./routes/insights.js')
const { default: dashboardRouter } = await import('./routes/dashboard.js')
const { default: actionsRouter } = await import('./routes/actions.js')
const { default: historyRouter } = await import('./routes/history.js')
const { default: chatRouter } = await import('./routes/chat.js')
const { default: userRouter } = await import('./routes/user.js')
const { default: expenseAnalyzerRouter } = await import('./routes/expenseAnalyzer.js')
const { default: notificationsRouter } = await import('./routes/notifications.js')
const { default: trackersRouter } = await import('./routes/trackers.js')
const { default: billingRouter } = await import('./routes/billing.js')
const { default: exportRouter } = await import('./routes/export.js')
const { default: categoryLimitsRouter } = await import('./routes/categoryLimits.js')
const { default: paydayRouter } = await import('./routes/payday.js')
const { default: weeklyReviewRouter } = await import('./routes/weeklyReview.js')
const { default: monthConditionRouter } = await import('./routes/monthCondition.js')
const { default: beforeYouSpendRouter } = await import('./routes/beforeYouSpend.js')
const { default: plaidWebhooksRouter } = await import('./routes/plaidWebhooks.js')
const { startQueue } = await import('./queue/index.js')
const { stopQueue } = await import('./queue/boss.js')
const { GENERIC_ERROR_MESSAGE } = await import('./utils/apiErrors.js')
const {
  globalRateLimiter,
  securityHeaders,
  webhookRateLimiter,
} = await import('./middleware/security.js')
const { areDevEndpointsEnabled } = await import('./utils/runtimeFlags.js')
const { demoMode, isDemoModeEnabled, DEMO_USER_ID } = await import('./middleware/demoMode.js')

const app = express()
const port = Number(process.env.PORT) || 5000
const devEndpointsEnabled = areDevEndpointsEnabled()
// WORKER_MODE=1 runs this process as a pure queue worker — no HTTP listener.
// Lets you scale queue capacity independently from web capacity across two
// Railway services later. Default (unset) keeps today's single-service
// deploy: one process serves HTTP AND runs queue workers.
const isWorkerMode = process.env.WORKER_MODE === '1'

// Railway sits behind a reverse proxy — needed for rate limiting by client IP.
app.set('trust proxy', 1)

app.use(securityHeaders)

// CORS must run BEFORE rate limiting. Otherwise a 429 response has no
// Access-Control-Allow-Origin header and the browser reports a misleading CORS error.
function normalizeOrigin(origin) {
  return origin.replace(/^["']|["']$/g, '').replace(/\/$/, '').trim()
}

function parseAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean)

  // Localhost is opt-in via ENABLE_DEV_ENDPOINTS=1 — never auto-open just
  // because NODE_ENV is unset (that would widen CORS on a misconfigured host).
  if (devEndpointsEnabled) {
    return [
      ...new Set([
        ...fromEnv,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]),
    ]
  }

  return fromEnv
}

const allowedOrigins = parseAllowedOrigins()

function isOriginAllowed(origin) {
  if (!origin) {
    return true
  }
  return allowedOrigins.includes(normalizeOrigin(origin))
}

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn(
    '[CORS] ALLOWED_ORIGINS is empty — browser requests from Vercel will be blocked'
  )
} else {
  console.log(`[CORS] ${allowedOrigins.length} allowed origin(s): ${allowedOrigins.join(', ')}`)
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true)
      } else {
        console.warn(
          `[CORS] blocked origin: ${origin ?? '(none)'} — allowed: ${allowedOrigins.join(', ')}`
        )
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  })
)

app.use(globalRateLimiter)

// Webhooks must read the raw body (not JSON) so signatures can be verified.
// That is why these routes come BEFORE express.json().
// Mount Stripe under its own path first so it is not handled by the Clerk router.
app.use('/webhooks', webhookRateLimiter)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhooksRouter)
app.use('/webhooks/plaid', express.raw({ type: 'application/json' }), plaidWebhooksRouter)
app.use('/webhooks', express.raw({ type: 'application/json' }), webhooksRouter)

// express.json() turns incoming JSON text into req.body objects we can use.
app.use(express.json({ limit: '100kb' }))

// Read-only demo sessions (DEMO_MODE=1 + x-soverm-demo header). Must run
// BEFORE clerkMiddleware so demo requests skip Clerk entirely.
app.use(demoMode())
if (isDemoModeEnabled()) {
  console.log(`[demo] DEMO_MODE enabled — read-only demo sessions as ${DEMO_USER_ID}`)
}

// clerkMiddleware checks "is this person logged in?"
// It can read login info from cookies OR from Authorization: Bearer headers.
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })
)

// All Plaid bank-connection routes live under /api/plaid
app.use('/api/plaid', plaidRouter)

// AI-generated financial insights live under /api/insights
app.use('/api/insights', insightsRouter)

// Dashboard summary data lives under /api/dashboard
app.use('/api/dashboard', dashboardRouter)

// User action items live under /api/actions
app.use('/api/actions', actionsRouter)

// Insight history lives under /api/history
app.use('/api/history', historyRouter)

// Insight follow-up chat lives under /api/chat
app.use('/api/chat', chatRouter)

// Account deletion lives under /api/user
app.use('/api/user', userRouter)

// Expense Analyzer data lives under /api/expense-analyzer
app.use('/api/expense-analyzer', expenseAnalyzerRouter)

// Proactive notifications live under /api/notifications
app.use('/api/notifications', notificationsRouter)

// Monthly trackers live under /api/trackers
app.use('/api/trackers', trackersRouter)

// Stripe Checkout for Soverm Pro
app.use('/api/billing', billingRouter)

// Monthly snapshot export
app.use('/api/export', exportRouter)

// Category soft limits
app.use('/api/category-limits', categoryLimitsRouter)

// Payday preferences (paycheck-to-paycheck what's left)
app.use('/api/payday', paydayRouter)

// Weekly check-in for paycheck-to-paycheck ICP
app.use('/api/weekly-review', weeklyReviewRouter)

// Month-end / month-so-far accountant condition letter
app.use('/api/month-condition', monthConditionRouter)
app.use('/api/before-you-spend', beforeYouSpendRouter)

app.use('/', healthRoutes)

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// Dev-only sanity checks — opt-in with ENABLE_DEV_ENDPOINTS=1 (never NODE_ENV alone).
if (devEndpointsEnabled) {
  app.get('/protected', requireAuth(), (req, res) => {
    res.json({
      message: 'You are authenticated',
      userId: req.auth.userId,
    })
  })

  app.get('/test-db', async (req, res) => {
    try {
      const result = await db.query('SELECT NOW()')
      res.json({ connected: true, time: result.rows[0] })
    } catch (err) {
      res.json({ connected: false, error: err.message })
    }
  })
}

// Express error middleware (after Sentry.setupExpressErrorHandler).
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  captureServerError(err, {
    label: 'express_error_handler',
    path: req?.originalUrl || req?.path,
  })
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
})

async function runStartupChecks() {
  const { logIntegrationConfigStatus } = await import('./utils/integrationConfig.js')
  logIntegrationConfigStatus()

  const { alertIfPlaintextPlaidTokensRemain } = await import('./utils/tokenCrypto.js')
  await alertIfPlaintextPlaidTokensRemain(db)
}

let server = null

if (isWorkerMode) {
  console.log('[worker] WORKER_MODE=1 — starting queue workers only (no HTTP listener)')
  await runStartupChecks()
  await startQueue()
} else {
  server = app.listen(port, '0.0.0.0', async () => {
    console.log(`CFO Agent API listening on port ${port}`)
    console.info(
      `[runtime] NODE_ENV=${process.env.NODE_ENV || '(unset)'} ` +
        `RAILWAY_ENVIRONMENT=${process.env.RAILWAY_ENVIRONMENT || '(unset)'}`
    )
    if (devEndpointsEnabled) {
      console.warn('[security] ENABLE_DEV_ENDPOINTS=1 — /test-db and /sentry-test are live')
    }

    await runStartupChecks()
    await startQueue()
  })

  server.on('error', (error) => {
    console.error('Server failed to start:', error)
    process.exit(1)
  })
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  const err = reason instanceof Error ? reason : new Error(String(reason))
  captureServerError(err, { label: 'unhandled_rejection' })
})

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await stopQueue()
  if (server) {
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
})

export { app, db, server }
