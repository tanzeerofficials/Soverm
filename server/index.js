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
const { default: plaidRouter } = await import('./routes/plaid.js')
const { default: insightsRouter } = await import('./routes/insights.js')
const { default: dashboardRouter } = await import('./routes/dashboard.js')
const { default: actionsRouter } = await import('./routes/actions.js')
const { default: historyRouter } = await import('./routes/history.js')
const { startSyncJob } = await import('./jobs/syncAllUsers.js')

const app = express()
const port = Number(process.env.PORT) || 5000

// cors lets our React app (running on a different origin) talk to this server.
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://soverm.vercel.app',
    ],
    credentials: true,
  })
)

// Webhooks must read the raw body (not JSON) so signatures can be verified.
// That is why this route comes BEFORE express.json().
app.use('/webhooks', express.raw({ type: 'application/json' }), webhooksRouter)

// express.json() turns incoming JSON text into req.body objects we can use.
app.use(express.json())

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

app.use('/', healthRoutes)

/*
 * Test route: /protected
 *
 * What it does:
 * - Only works if you are logged in with Clerk.
 *
 * Why we have it:
 * - It is a simple way to test that login is working on the server.
 */
app.get('/protected', requireAuth(), (req, res) => {
  res.json({
    message: 'You are authenticated',
    userId: req.auth.userId,
  })
})

/*
 * Test route: /test-db
 *
 * What it does:
 * - Runs a tiny database query (SELECT NOW()) to check if Postgres is connected.
 *
 * Why we have it:
 * - If the app feels broken, this helps us quickly see if the database is the problem.
 */
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()')
    res.json({ connected: true, time: result.rows[0] })
  } catch (err) {
    res.json({ connected: false, error: err.message })
  }
})

const server = app.listen(port, () => {
  console.log(`CFO Agent API listening on port ${port}`)
  startSyncJob()
  console.log('Auto-sync job scheduled (every 4 hours)')
})

server.on('error', (error) => {
  console.error('Server failed to start:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export { app, db, server }
