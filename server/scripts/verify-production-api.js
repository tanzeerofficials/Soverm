/*
 * Smoke-test deployed API routes that depend on migrations 006 + 007.
 *
 * Usage:
 *   API_URL=https://soverm-production.up.railway.app \
 *   CLERK_SESSION_TOKEN='eyJ...' \
 *   INSIGHT_ID='uuid-of-an-insight-you-own' \
 *   node scripts/verify-production-api.js
 *
 * Get CLERK_SESSION_TOKEN: log in at soverm.vercel.app → DevTools → Network →
 * any /api/ request → copy the Bearer token from Authorization header.
 */

import 'dotenv/config'

const apiUrl = (process.env.API_URL || '').replace(/\/$/, '')
const token = process.env.CLERK_SESSION_TOKEN
const insightId = process.env.INSIGHT_ID

if (!apiUrl || !token) {
  console.error('API_URL and CLERK_SESSION_TOKEN are required.')
  process.exit(1)
}

async function check(label, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 200)
  }
  const ok = res.status >= 200 && res.status < 300
  console.log(`${label}: HTTP ${res.status}${ok ? ' OK' : ' FAIL'}`)
  if (!ok) console.log('  ', body)
  return ok
}

async function main() {
  console.log('API:', apiUrl)

  const health = await check('GET /', `${apiUrl}/`)
  const usage = await check('GET /api/insights/usage', `${apiUrl}/api/insights/usage`)

  let chat = true
  if (insightId) {
    chat = await check(
      'POST /api/chat/:insightId',
      `${apiUrl}/api/chat/${insightId}`,
      { method: 'POST', body: JSON.stringify({ message: 'Migration smoke test — ignore.' }) }
    )
  } else {
    console.log('POST /api/chat/:insightId: SKIPPED (set INSIGHT_ID to test)')
  }

  process.exit(health && usage && chat ? 0 : 1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
