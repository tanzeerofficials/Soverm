/*
 * QUEUE WORK HANDLERS
 *
 * The actual per-job logic for each queue registered in queue/index.js.
 * pg-boss's default work() handler always receives a batch array (even at
 * batchSize 1) — every handler here processes its batch with Promise.all so
 * behavior is correct regardless of the batchSize configured per queue.
 *
 * Job-level errors are NOT swallowed here — letting them throw is what makes
 * pg-boss retry the job and (after retryLimit) route it to the dead letter
 * state, instead of a failure silently vanishing like the old setImmediate /
 * in-memory-flag code could.
 */

import { getSyncableUserIds } from '../jobs/syncAllUsers.js'
import { runWeeklyDigestJob } from '../jobs/weeklyDigest.js'
import { runMonthConditionNotifyJob } from '../jobs/monthConditionNotify.js'
import { syncAllAccountsForUser } from '../services/plaid.js'
import { evaluateAndCreateProactiveNotifications } from '../services/proactiveNotifications.js'
import { scanAndStoreSavingsTransferDetections } from '../services/savingsTransferDetection.js'
import { markWebhookEvent } from '../utils/plaidWebhookEvents.js'
import { captureServerError, reportServerError } from '../utils/sentry.js'
import { enqueueUserSync } from './boss.js'

async function syncOneUser({ userId, webhookEventId }) {
  if (webhookEventId) {
    await markWebhookEvent(webhookEventId, 'processing')
  }

  try {
    // syncAllAccountsForUser already wraps itself in withUserPlaidSyncLock
    // (services/plaid.js) — do not add a second lock here. Postgres advisory
    // locks are not reentrant across connections, so a second acquisition
    // for the same userId on a different pooled connection would deadlock
    // waiting for the first (which never releases, because it's waiting on
    // this).
    const { added, modified, removed, partial } = await syncAllAccountsForUser(userId)
    console.log(
      `[sync-user] ${userId}: ${added} added, ${modified} modified, ${removed} removed${
        partial ? ' (partial)' : ''
      }`
    )
    await evaluateAndCreateProactiveNotifications(userId)
    await scanAndStoreSavingsTransferDetections(userId)

    if (webhookEventId) {
      await markWebhookEvent(webhookEventId, 'done')
    }
  } catch (err) {
    if (webhookEventId) {
      await markWebhookEvent(webhookEventId, 'failed', err.message?.slice(0, 500) ?? 'unknown_error')
    }
    reportServerError('to sync user via queue', err, { userId })
    throw err // let pg-boss retry
  }
}

/** sync-user queue — one job per user, policy 'exclusive' on singletonKey=userId. */
export async function handleSyncUser(jobs) {
  await Promise.all(jobs.map((job) => syncOneUser(job.data)))
}

/** sync-fanout queue — scheduled every 4h; replaces the old sequential for-loop. */
export async function handleSyncFanout(jobs) {
  await Promise.all(
    jobs.map(async () => {
      const userIds = await getSyncableUserIds()
      console.log(`[sync-fanout] enqueuing sync for ${userIds.length} user(s)`)

      await Promise.all(
        userIds.map(async (userId) => {
          try {
            await enqueueUserSync({ userId })
          } catch (err) {
            captureServerError(err, { label: 'sync_fanout_enqueue', userId })
            console.error(`[sync-fanout] failed to enqueue ${userId}:`, err.message)
          }
        })
      )
    })
  )
}

/** weekly-digest queue — scheduled Sundays 14:00 UTC. */
export async function handleWeeklyDigest(jobs) {
  await Promise.all(
    jobs.map(() =>
      runWeeklyDigestJob().catch((err) => {
        captureServerError(err, { label: 'weekly_digest_job' })
        console.error('[weekly-digest] job crashed:', err.message)
        throw err
      })
    )
  )
}

/** month-condition-notify queue — scheduled daily 14:05 UTC; only acts on day 1. */
export async function handleMonthConditionNotify(jobs) {
  await Promise.all(
    jobs.map(() =>
      runMonthConditionNotifyJob().catch((err) => {
        captureServerError(err, { label: 'month_condition_notify_job' })
        console.error('[month-condition-notify] job crashed:', err.message)
        throw err
      })
    )
  )
}
