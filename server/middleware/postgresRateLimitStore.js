/*
 * POSTGRES RATE LIMIT STORE
 *
 * express-rate-limit's default MemoryStore counts hits in process memory —
 * correct for one instance, wrong the moment there's a second one (Railway
 * replica, or a worker process). Two instances each think they're the only
 * one enforcing the limit, so the real ceiling is (configured max) × (number
 * of instances) instead of the configured max.
 *
 * This store keeps the same fixed-window counting semantics as MemoryStore
 * (a key's window starts on first hit and resets after windowMs elapses),
 * but counts in the Postgres we already have — reusing db/index.js's pool,
 * no new infra, no second pg-boss-style dependency.
 *
 * One physical table (rate_limit_hits) serves every rate limiter in the
 * app: each limiter gets its own PostgresStore instance constructed with a
 * distinct `prefix`, and every key is namespaced as "<prefix>:<key>" so a
 * userId used by two different limiters (e.g. plaidRateLimiter and
 * syncRateLimiter) can never collide in the same row.
 */

import db from '../db/index.js'

/** Cheap, no-extra-job cleanup: on ~1% of increments, sweep long-expired rows. */
const CLEANUP_SAMPLE_RATE = 0.01
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000

async function cleanupExpiredRows() {
  try {
    await db.query(
      `DELETE FROM rate_limit_hits WHERE reset_time < NOW() - ($1::numeric * INTERVAL '1 millisecond')`,
      [CLEANUP_AFTER_MS]
    )
  } catch (err) {
    console.warn('[rate-limit-store] cleanup failed:', err.message)
  }
}

export class PostgresRateLimitStore {
  /** @param {{ prefix: string }} options */
  constructor({ prefix }) {
    if (!prefix) {
      throw new Error('PostgresRateLimitStore requires a prefix to namespace its keys')
    }
    this.prefix = prefix
    this.windowMs = 60 * 1000 // overwritten by init(); this is just a safe default
    this.localKeys = false // hits are visible to every instance, not just this one
  }

  init(options) {
    this.windowMs = options.windowMs
  }

  namespacedKey(key) {
    return `${this.prefix}:${key}`
  }

  async get(key) {
    const result = await db.query(
      `SELECT hits, reset_time FROM rate_limit_hits WHERE key = $1`,
      [this.namespacedKey(key)]
    )
    const row = result.rows[0]
    if (!row) {
      return undefined
    }
    return { totalHits: row.hits, resetTime: row.reset_time }
  }

  async increment(key) {
    if (Math.random() < CLEANUP_SAMPLE_RATE) {
      cleanupExpiredRows() // fire-and-forget — never block a request on this
    }

    // Single atomic UPSERT: the ON CONFLICT branch takes a row lock, so
    // concurrent increments for the same key (from this instance or any
    // other) are correctly serialized — no lost updates, no read-then-write
    // race. If the previous window has expired, start a fresh one at 1;
    // otherwise increment within the current window.
    const result = await db.query(
      `INSERT INTO rate_limit_hits (key, hits, reset_time)
       VALUES ($1, 1, NOW() + ($2::numeric * INTERVAL '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE
           WHEN rate_limit_hits.reset_time <= NOW() THEN 1
           ELSE rate_limit_hits.hits + 1
         END,
         reset_time = CASE
           WHEN rate_limit_hits.reset_time <= NOW()
             THEN NOW() + ($2::numeric * INTERVAL '1 millisecond')
           ELSE rate_limit_hits.reset_time
         END
       RETURNING hits, reset_time`,
      [this.namespacedKey(key), this.windowMs]
    )

    const row = result.rows[0]
    return { totalHits: row.hits, resetTime: row.reset_time }
  }

  async decrement(key) {
    await db.query(
      `UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = $1`,
      [this.namespacedKey(key)]
    )
  }

  async resetKey(key) {
    await db.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [this.namespacedKey(key)])
  }

  async resetAll() {
    await db.query(`DELETE FROM rate_limit_hits WHERE key LIKE $1`, [`${this.prefix}:%`])
  }
}
