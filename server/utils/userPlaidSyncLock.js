/*
 * USER PLAID SYNC LOCK
 *
 * What this does: serializes syncAllAccountsForUser per Clerk user across
 * every server replica (dashboard Sync, cron, webhook, post-link).
 *
 * Why: without a lock, overlapping syncs corrupt cursors / double-apply
 * transaction upserts when webhook + manual sync + cron collide.
 *
 * How: PostgreSQL session advisory lock on a dedicated pool connection held
 * for the duration of fn(). The lock auto-releases if the process dies.
 */

import db from '../db/index.js'

/** Namespace int so plaid-sync locks never collide with other advisory locks. */
export const PLAID_SYNC_LOCK_NAMESPACE = 904_221_017

export async function withUserPlaidSyncLock(userId, fn) {
  if (!userId) {
    return fn()
  }

  const client = await db.connect()

  try {
    await client.query(`SELECT pg_advisory_lock($1, hashtext($2::text))`, [
      PLAID_SYNC_LOCK_NAMESPACE,
      userId,
    ])

    return await fn()
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock($1, hashtext($2::text))`, [
        PLAID_SYNC_LOCK_NAMESPACE,
        userId,
      ])
    } catch (err) {
      console.warn(`[plaid-sync-lock] unlock failed for ${userId}:`, err.message)
    }
    client.release()
  }
}
