/*
 * MONTH-END CONDITION NOTIFY JOB
 *
 * Runs daily; only delivers on the 1st of the month (app timezone) so
 * yesterday’s closed month letter gets an email + in-app alert.
 */

import cron from 'node-cron'
import db from '../db/index.js'
import {
  deliverMonthConditionNotifyForUser,
  shouldNotifyClosedMonth,
} from '../services/monthConditionNotify.js'
import { captureServerError } from '../utils/sentry.js'

let jobRunning = false

export async function runMonthConditionNotifyJob({ force = false } = {}) {
  if (!force && !shouldNotifyClosedMonth()) {
    console.info('[month-condition-notify] skipped — not day 1 of month (app TZ)')
    return { skipped: true, reason: 'not_month_start' }
  }

  if (jobRunning) {
    console.warn('[month-condition-notify] skipped — previous run still in progress')
    return { skipped: true, reason: 'in_progress' }
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
        const result = await deliverMonthConditionNotifyForUser(row.id)
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
        captureServerError(err, { label: 'month_condition_notify_user', userId: row.id })
        console.error(`[month-condition-notify] failed for ${row.id}:`, err.message)
      }
    }

    console.info(
      `[month-condition-notify] done in ${Date.now() - startedAt}ms — emailDelivered=${delivered} dryRun=${dryRun} inApp=${notified} skipped=${skipped} failed=${failed}`
    )

    return { delivered, dryRun, notified, skipped, failed }
  } finally {
    jobRunning = false
  }
}

export function startMonthConditionNotifyJob() {
  // Daily 14:05 UTC — only acts on day 1 in APP_TIMEZONE.
  cron.schedule('5 14 * * *', () => {
    runMonthConditionNotifyJob().catch((err) => {
      captureServerError(err, { label: 'month_condition_notify_job' })
      console.error('[month-condition-notify] job crashed:', err.message)
    })
  })

  console.log('Month-end condition notify job scheduled (daily 14:05 UTC; acts on day 1)')
}
