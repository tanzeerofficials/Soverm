/*
 * PG-BOSS SINGLETON
 *
 * Split out from index.js so handlers.js (sync-fanout needs to enqueue
 * sync-user jobs) and index.js (registers queues/workers/schedules) can both
 * depend on this without a circular import between the two.
 */

import { PgBoss } from 'pg-boss'

export const QUEUES = {
  SYNC_FANOUT: 'sync-fanout',
  SYNC_USER: 'sync-user',
  WEEKLY_DIGEST: 'weekly-digest',
  MONTH_CONDITION_NOTIFY: 'month-condition-notify',
}

let boss = null

export function getBoss() {
  if (!boss) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to start the queue')
    }
    boss = new PgBoss(process.env.DATABASE_URL)
    boss.on('error', (err) => {
      console.error('[queue] error:', err.message)
    })
  }
  return boss
}

/**
 * Enqueue a Plaid sync for one user. `webhookEventId`, when present, is
 * carried through so the sync-user handler can mark plaid_webhook_events
 * done/failed once the sync completes.
 *
 * Returns the job id, or null if a sync for this user is already queued or
 * active (the 'exclusive' policy silently drops the duplicate — this is the
 * expected, desired outcome, not an error).
 */
export async function enqueueUserSync({ userId, webhookEventId = null }) {
  const instance = getBoss()
  return instance.send(
    QUEUES.SYNC_USER,
    { userId, webhookEventId },
    { singletonKey: userId }
  )
}

export async function stopQueue() {
  if (!boss) {
    return
  }
  await boss.stop({ graceful: true, timeout: 30_000 })
}
