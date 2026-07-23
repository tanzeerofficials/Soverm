/*
 * Verifies the pg-boss singleton wiring without connecting to a real
 * Postgres — the PgBoss constructor is synchronous and does not open a
 * connection until .start(), so this is safe to run in CI (no DATABASE_URL
 * service there). Full end-to-end queue behavior (a webhook processed
 * exactly once by a worker) is verified manually — see README
 * "Verifying the queue".
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'

describe('queue/boss singleton', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  after(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  })

  test('QUEUES lists the four expected queue names', async () => {
    const { QUEUES } = await import('../queue/boss.js')
    assert.deepEqual(Object.values(QUEUES).sort(), [
      'month-condition-notify',
      'sync-fanout',
      'sync-user',
      'weekly-digest',
    ])
  })

  test('getBoss() throws without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    // Fresh module instance so the already-constructed singleton (if any
    // earlier test/import set one) doesn't mask the missing-env check.
    const mod = await import(`../queue/boss.js?no-db-url-check=${Date.now()}`)
    assert.throws(() => mod.getBoss(), /DATABASE_URL is required/)
  })

  test('getBoss() returns the same instance on repeated calls', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test_db'
    const mod = await import(`../queue/boss.js?singleton-check=${Date.now()}`)
    const first = mod.getBoss()
    const second = mod.getBoss()
    assert.strictEqual(first, second)
  })
})
