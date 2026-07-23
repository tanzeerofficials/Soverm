/*
 * Verifies the structural parts of PostgresRateLimitStore that don't need a
 * live Postgres connection (CI has none — see .github/workflows/ci.yml).
 * The actual DB-backed behavior (increment/get/decrement/window-expiry/
 * resetKey/resetAll, and prefix isolation between limiters sharing a raw
 * key) was verified manually against the dev database while building this
 * store — see README "Verifying the queue"-style manual check pattern; a
 * live two-instance rate-limit check is documented alongside it.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { PostgresRateLimitStore } from '../middleware/postgresRateLimitStore.js'

describe('PostgresRateLimitStore', () => {
  test('throws without a prefix', () => {
    assert.throws(() => new PostgresRateLimitStore({}), /requires a prefix/)
    assert.throws(() => new PostgresRateLimitStore({ prefix: '' }), /requires a prefix/)
  })

  test('stores the prefix and defaults localKeys to false', () => {
    const store = new PostgresRateLimitStore({ prefix: 'plaid' })
    assert.equal(store.prefix, 'plaid')
    assert.equal(store.localKeys, false)
  })

  test('namespacedKey joins prefix and key so different limiters never collide on the same raw key', () => {
    const plaidStore = new PostgresRateLimitStore({ prefix: 'plaid' })
    const syncStore = new PostgresRateLimitStore({ prefix: 'sync' })
    assert.equal(plaidStore.namespacedKey('user_123'), 'plaid:user_123')
    assert.equal(syncStore.namespacedKey('user_123'), 'sync:user_123')
    assert.notEqual(plaidStore.namespacedKey('user_123'), syncStore.namespacedKey('user_123'))
  })

  test('init() captures windowMs from the middleware options express-rate-limit passes it', () => {
    const store = new PostgresRateLimitStore({ prefix: 'plaid' })
    assert.notEqual(store.windowMs, 90_000) // sanity: not already this value
    store.init({ windowMs: 90_000, max: 30 })
    assert.equal(store.windowMs, 90_000)
  })
})
