/**
 * Route integration tests for /api/trackers (requires Postgres + migrations 013–014).
 *
 * Usage: node scripts/test-trackers-routes.js
 */

import 'dotenv/config'
import express from 'express'
import db from '../db/index.js'
import { createTrackersRouter } from '../routes/trackers.js'
import {
  hasMonthlyProgressColumns,
  hasMonthlyTrackersTable,
  resetMonthlyTrackersSchemaCache,
} from '../utils/monthlyTrackersSchema.js'

const TEST_USER_ID = 'integration_test_trackers_user'
const TEST_USER_EMAIL = 'integration-test-trackers@invalid.local'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function buildTestApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.auth = { userId }
    next()
  })
  app.use(
    '/api/trackers',
    createTrackersRouter({
      authenticate: (_req, _res, next) => next(),
      resolveUserId: (req) => req.auth?.userId,
    })
  )
  return app
}

async function request(app, method, path, body) {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()
    let json = null

    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = { raw: text }
      }
    }

    return { status: res.status, body: json }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

async function ensureTestUser({ tier = 'free' } = {}) {
  await db.query(
    `INSERT INTO users (id, email, name, subscription_tier)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           subscription_tier = EXCLUDED.subscription_tier`,
    [TEST_USER_ID, TEST_USER_EMAIL, 'Tracker Integration Test', tier]
  )
}

async function setUserTier(tier) {
  await db.query(`UPDATE users SET subscription_tier = $2 WHERE id = $1`, [
    TEST_USER_ID,
    tier,
  ])
}

async function cleanupTestUser() {
  await db.query(`DELETE FROM monthly_trackers WHERE user_id = $1`, [TEST_USER_ID])
  await db.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID])
}

function assertSnapshotShape(body) {
  assert(Array.isArray(body.trackers), 'snapshot includes trackers array')
  assert(typeof body.spentThisMonth === 'number', 'snapshot includes spentThisMonth')
  assert(typeof body.incomeThisMonth === 'number', 'snapshot includes incomeThisMonth')
  assert(typeof body.periodLabel === 'string', 'snapshot includes periodLabel')
  assert('configured' in body, 'snapshot includes configured flag')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('SKIP: DATABASE_URL not set — tracker route integration tests need Postgres')
    process.exit(0)
  }

  resetMonthlyTrackersSchemaCache()

  if (!(await hasMonthlyTrackersTable())) {
    console.log('SKIP: monthly_trackers table missing — run npm run migrate:013')
    process.exit(0)
  }

  if (!(await hasMonthlyProgressColumns())) {
    console.log('SKIP: monthly_progress_amount missing — run npm run migrate:014')
    process.exit(0)
  }

  console.log('Tracker route integration tests\n')

  await cleanupTestUser()
  await ensureTestUser()

  const app = buildTestApp(TEST_USER_ID)
  let passed = 0

  const emptyGet = await request(app, 'GET', '/api/trackers')
  assert(emptyGet.status === 200, `GET empty snapshot returns 200 (got ${emptyGet.status})`)
  assertSnapshotShape(emptyGet.body)
  assert(emptyGet.body.configured === false, 'no spending tracker initially')
  assert(emptyGet.body.trackers.length === 0, 'trackers list starts empty')
  console.log('  pass: GET empty snapshot')
  passed++

  const freeCreate = await request(app, 'POST', '/api/trackers', {
    trackType: 'spending',
    monthlyAmount: 1500,
    name: 'Free spending cap',
  })
  assert(freeCreate.status === 200, `free POST spending returns 200 (got ${freeCreate.status})`)
  assert(freeCreate.body.configured === true, 'free spending cap configures snapshot')
  console.log('  pass: free tier can create one spending cap')
  passed++

  const freeSaving = await request(app, 'POST', '/api/trackers', {
    trackType: 'saving',
    monthlyAmount: 100,
    name: 'Blocked buffer',
    purposeType: 'future',
  })
  assert(freeSaving.status === 403, `free POST saving returns 403 (got ${freeSaving.status})`)
  assert(freeSaving.body.error === 'pro_required', 'free saving returns pro_required')
  console.log('  pass: free tier cannot create savings goals')
  passed++

  const freeAlerts = await request(app, 'POST', '/api/trackers', {
    trackType: 'spending',
    monthlyAmount: 1600,
    name: 'Alert attempt',
    alertWarningPercent: 50,
  })
  assert(freeAlerts.status === 403, `free custom alerts return 403 (got ${freeAlerts.status})`)
  console.log('  pass: free tier cannot set custom alert thresholds')
  passed++

  await setUserTier('pro')

  const createSpending = await request(app, 'POST', '/api/trackers', {
    trackType: 'spending',
    monthlyAmount: 1500,
    name: 'Test spending cap',
  })
  assert(createSpending.status === 200, `POST spending tracker returns 200 (got ${createSpending.status})`)
  assertSnapshotShape(createSpending.body)
  assert(createSpending.body.configured === true, 'spending tracker configures snapshot')
  assert(createSpending.body.spendingTracker?.monthlyAmount === 1500, 'spending cap amount saved')
  assert(createSpending.body.spendingTracker?.name === 'Test spending cap', 'spending cap name saved')
  const spendingId = createSpending.body.tracker?.id ?? createSpending.body.spendingTracker?.id
  assert(spendingId, 'spending tracker id returned')
  console.log('  pass: POST spending tracker')
  passed++

  const duplicateSpending = await request(app, 'POST', '/api/trackers', {
    trackType: 'spending',
    monthlyAmount: 1800,
    name: 'Updated spending cap',
  })
  assert(duplicateSpending.status === 200, 'second POST spending updates existing cap')
  assert(duplicateSpending.body.trackers.filter((t) => t.trackType === 'spending').length === 1, 'only one active spending tracker')
  assert(duplicateSpending.body.spendingTracker?.monthlyAmount === 1800, 'spending cap amount updated')
  assert(duplicateSpending.body.spendingTracker?.id === spendingId, 'same spending tracker row updated')
  console.log('  pass: POST spending tracker is upsert')
  passed++

  const patchSpending = await request(app, 'PATCH', `/api/trackers/${spendingId}`, {
    monthlyAmount: 2000,
  })
  assert(patchSpending.status === 200, 'PATCH spending cap succeeds')
  assert(patchSpending.body.spendingTracker?.monthlyAmount === 2000, 'PATCH updates monthly amount')
  console.log('  pass: PATCH spending tracker')
  passed++

  const createSaving = await request(app, 'POST', '/api/trackers', {
    trackType: 'saving',
    name: 'Emergency fund',
    purposeType: 'future',
    monthlyAmount: 300,
    targetTotal: 1200,
  })
  assert(createSaving.status === 200, 'POST saving tracker succeeds')
  const savingId = createSaving.body.tracker?.id
  assert(savingId, 'saving tracker id returned')
  assert(createSaving.body.savingTrackers.length === 1, 'one saving tracker in snapshot')
  assert(createSaving.body.savingTrackers[0].progress?.savedThisMonth === 0, 'monthly savings starts at zero')
  console.log('  pass: POST saving tracker')
  passed++

  const logSaving = await request(app, 'PATCH', `/api/trackers/${savingId}`, {
    progressAmount: 120,
  })
  assert(logSaving.status === 200, 'PATCH saving progress succeeds')
  assert(logSaving.body.savingTrackers[0].progress?.savedThisMonth === 120, 'monthly saved amount logged')
  assert(logSaving.body.savingTrackers[0].progress?.totalSaved === 120, 'lifetime total updated')
  console.log('  pass: PATCH saving monthly progress')
  passed++

  const badId = await request(app, 'PATCH', '/api/trackers/not-a-uuid', { monthlyAmount: 100 })
  assert(badId.status === 400, 'invalid tracker id returns 400')
  console.log('  pass: PATCH rejects invalid id')
  passed++

  const missing = await request(app, 'PATCH', '/api/trackers/00000000-0000-4000-8000-000000000099', {
    monthlyAmount: 100,
  })
  assert(missing.status === 404, 'missing tracker returns 404')
  console.log('  pass: PATCH missing tracker returns 404')
  passed++

  const deleteSpending = await request(app, 'DELETE', `/api/trackers/${spendingId}`)
  assert(deleteSpending.status === 200, 'DELETE spending tracker succeeds')
  assert(deleteSpending.body.spendingTracker == null, 'spending tracker removed from snapshot')
  assert(deleteSpending.body.configured === false, 'configured false after delete')
  console.log('  pass: DELETE spending tracker')
  passed++

  const deleteSaving = await request(app, 'DELETE', `/api/trackers/${savingId}`)
  assert(deleteSaving.status === 200, 'DELETE saving tracker succeeds')
  assert(deleteSaving.body.savingTrackers.length === 0, 'saving tracker removed from snapshot')
  assert(deleteSaving.body.trackers.length === 0, 'all trackers cleared')
  console.log('  pass: DELETE saving tracker')
  passed++

  await cleanupTestUser()
  await db.end()

  console.log(`\n${passed}/${passed} tracker route integration tests passed.`)
}

main().catch(async (err) => {
  console.error(`\nFAILED: ${err.message}`)
  try {
    await cleanupTestUser()
    await db.end()
  } catch {
    // ignore cleanup errors
  }
  process.exit(1)
})
