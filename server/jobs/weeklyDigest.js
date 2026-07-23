/*
 * WEEKLY DIGEST JOB
 *
 * For each opted-in user, builds an email-ready digest and delivers it (or
 * dry-runs to the server log until Resend is configured). Scheduling lives
 * in queue/index.js (pg-boss, Sundays 14:00 UTC) — this file is just the
 * per-run logic, invoked by queue/handlers.js.
 */

import db from '../db/index.js'
import { deliverWeeklyDigestForUser } from '../services/weeklyDigest.js'
import { captureServerError } from '../utils/sentry.js'

let jobRunning = false

export async function runWeeklyDigestJob() {
  if (jobRunning) {
    console.warn('[weekly-digest] skipped — previous run still in progress')
    return { skipped: true }
  }

  jobRunning = true
  const startedAt = Date.now()
  let delivered = 0
  let dryRun = 0
  let skipped = 0
  let failed = 0
  let notified = 0

  try {
    const users = await db.query(
      `SELECT id
       FROM users
       WHERE proactive_notifications_enabled IS DISTINCT FROM false
       ORDER BY created_at ASC`
    )

    for (const row of users.rows) {
      try {
        const result = await deliverWeeklyDigestForUser(row.id)
        if (result.notificationCreated) {
          notified += 1
        }
        if (result.delivered) {
          delivered += 1
        } else if (result.dryRun) {
          dryRun += 1
        } else {
          skipped += 1
        }
      } catch (err) {
        failed += 1
        captureServerError(err, { label: 'weekly_digest_user', userId: row.id })
        console.error(`[weekly-digest] failed for ${row.id}:`, err.message)
      }
    }

    console.info(
      `[weekly-digest] done in ${Date.now() - startedAt}ms — emailDelivered=${delivered} dryRun=${dryRun} inApp=${notified} skipped=${skipped} failed=${failed}`
    )

    return { delivered, dryRun, notified, skipped, failed }
  } finally {
    jobRunning = false
  }
}
