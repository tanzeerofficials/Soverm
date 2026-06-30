/*
 * Verifies server Sentry captures insight-generation failures without leaking secrets.
 *
 * Usage (from server/):
 *   node scripts/verify-sentry-insight.js
 *
 * Uses a throwaway port and invalid ANTHROPIC_API_KEY — does not modify .env.
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClerkClient } from '@clerk/backend'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { scrubSentryEvent, Sentry } from '../utils/sentry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

process.env.PORT = '3099'
process.env.ANTHROPIC_API_KEY = 'sk-ant-invalid-sentry-verification'

const { pool } = await import('../db/index.js')
const { server } = await import('../index.js')

function waitForListen() {
  return new Promise((resolve) => {
    if (server.listening) {
      resolve()
      return
    }
    server.on('listening', resolve)
  })
}

await waitForListen()
const port = server.address().port

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

const accountRows = await pool.query(
  'SELECT DISTINCT user_id FROM accounts ORDER BY user_id'
)
const clerkUsers = await clerk.users.getUserList({ limit: 100 })
const clerkUserIds = new Set(clerkUsers.data.map((u) => u.id))

let userId = accountRows.rows
  .map((r) => r.user_id)
  .find((id) => clerkUserIds.has(id))

if (!userId && clerkUsers.data.length > 0) {
  userId = clerkUsers.data[0].id
  console.warn('Using Clerk user without DB accounts — Claude call will still fail for Sentry test.')
}

if (!userId) {
  console.error('No Clerk users found — sign in to the app first.')
  server.close()
  process.exit(1)
}

const session = await clerk.sessions.createSession({ userId })
const { jwt } = await clerk.sessions.getToken(session.id)

const res = await fetch(`http://127.0.0.1:${port}/api/insights/generate`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  },
})

const body = await res.json()
console.log('POST /api/insights/generate status:', res.status)
console.log('Response error field:', body.error)

const scrubbed = scrubSentryEvent({
  request: {
    headers: { authorization: 'Bearer secret-jwt', 'x-api-key': 'sk-ant-real' },
    data: { balance: 5000, transactions: [{ amount: 100 }] },
    cookies: { session: 'abc' },
  },
  extra: { api_key: 'leaked', account_balance: 9999, insight: 'private' },
})

const scrubbedJson = JSON.stringify(scrubbed)
const leaks = ['secret-jwt', 'sk-ant-real', '5000', 'private'].filter((s) =>
  scrubbedJson.includes(s)
)

console.log('Scrub check — sensitive values absent:', leaks.length === 0)
if (leaks.length) {
  console.error('Scrub failed, found:', leaks)
}

const flushed = await Sentry.flush(8000)
console.log('Sentry flush:', flushed ? 'ok' : 'timed out')

await clerk.sessions.revokeSession(session.id)
server.close()

const ok =
  res.status === 500 &&
  body.error === GENERIC_ERROR_MESSAGE &&
  leaks.length === 0 &&
  flushed

process.exit(ok ? 0 : 1)
