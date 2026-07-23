/*
 * SYNCABLE USERS
 *
 * Which users the sync-fanout job should enqueue a sync-user job for.
 * Scheduling + per-user dispatch now live in queue/index.js + queue/handlers.js
 * (pg-boss) — this file is just the "who" query, kept separate so it stays
 * unit-testable without pulling in the queue.
 */

import db from '../db/index.js'
import { DEMO_USER_ID } from '../middleware/demoMode.js'

export async function getSyncableUserIds() {
  // Demo user's Plaid item is fake (seed-demo-user.js) — never sync it.
  const result = await db.query(
    'SELECT DISTINCT user_id FROM accounts WHERE user_id <> $1',
    [DEMO_USER_ID]
  )
  return result.rows.map((row) => row.user_id)
}
