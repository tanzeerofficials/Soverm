/*
 * QUEUE (pg-boss) — registration + lifecycle
 *
 * What this replaces:
 * - node-cron running IN-PROCESS with in-memory "already running" flags
 *   (syncRunning, jobRunning) — these only protect a single process. Run 2
 *   Railway replicas and every user gets synced twice, digests send twice.
 * - Plaid webhook processing via setImmediate — fire-and-forget. If the
 *   process restarts/deploys between the 200 ACK and setImmediate running,
 *   that sync is silently lost — no retry, no trace.
 *
 * What this gives us, using the Postgres we already have (no new infra):
 * - Jobs survive process restarts/deploys (they're rows in Postgres, not
 *   memory) and are retried on failure.
 * - Exactly-once execution across any number of replicas — pg-boss dequeues
 *   with `FOR UPDATE SKIP LOCKED`, so two workers can never pick up the same
 *   job. Per-user sync jobs additionally use queue policy 'exclusive' with
 *   singletonKey = userId, so a given user can never have two sync jobs
 *   queued or active at once (replaces both syncRunning and the risk of a
 *   webhook + cron fanout racing each other for the same user).
 *
 * Queues:
 * - sync-fanout            (scheduled every 4h) — enqueues one sync-user job
 *                           per connected user, replacing the sequential for-loop.
 * - sync-user               (exclusive per userId) — the actual Plaid sync +
 *                           notification scan + savings scan for one user.
 *                           Enqueued by sync-fanout AND by the Plaid webhook
 *                           route (see queue/boss.js enqueueUserSync).
 * - weekly-digest           (scheduled Sundays 14:00 UTC)
 * - month-condition-notify  (scheduled daily 14:05 UTC; only acts on day 1)
 *
 * Process modes (see ../index.js):
 * - Default: one process serves HTTP AND runs queue workers (today's single-
 *   service Railway deploy keeps working unchanged).
 * - WORKER_MODE=1: process runs ONLY queue workers, no HTTP listener — lets
 *   you scale worker capacity independently of web capacity later.
 * Both modes call startQueue(); pg-boss's own locking makes it safe to run
 * any number of each at once.
 */

import { getBoss, QUEUES, enqueueUserSync, stopQueue } from './boss.js'
import {
  handleSyncFanout,
  handleSyncUser,
  handleWeeklyDigest,
  handleMonthConditionNotify,
} from './handlers.js'

export { QUEUES, enqueueUserSync, stopQueue }

async function ensureQueues(instance) {
  await instance.createQueue(QUEUES.SYNC_FANOUT, { policy: 'exclusive' })
  await instance.createQueue(QUEUES.SYNC_USER, { policy: 'exclusive' })
  await instance.createQueue(QUEUES.WEEKLY_DIGEST, { policy: 'exclusive' })
  await instance.createQueue(QUEUES.MONTH_CONDITION_NOTIFY, { policy: 'exclusive' })
}

async function registerWorkers(instance) {
  await instance.work(QUEUES.SYNC_FANOUT, handleSyncFanout)
  await instance.work(QUEUES.SYNC_USER, { batchSize: 5 }, handleSyncUser)
  await instance.work(QUEUES.WEEKLY_DIGEST, handleWeeklyDigest)
  await instance.work(QUEUES.MONTH_CONDITION_NOTIFY, handleMonthConditionNotify)
}

async function registerSchedules(instance) {
  // tz explicit (not ambient/system-default) — same intent as the original
  // node-cron comments ("Sundays at 14:00 UTC"), now guaranteed rather than
  // assumed from the container's local timezone.
  await instance.schedule(QUEUES.SYNC_FANOUT, '0 */4 * * *', {}, { tz: 'UTC' })
  await instance.schedule(QUEUES.WEEKLY_DIGEST, '0 14 * * 0', {}, { tz: 'UTC' })
  await instance.schedule(QUEUES.MONTH_CONDITION_NOTIFY, '5 14 * * *', {}, { tz: 'UTC' })
}

/** Start pg-boss, its queues, workers, and schedules. Call once per process. */
export async function startQueue() {
  const instance = getBoss()
  await instance.start()
  await ensureQueues(instance)
  await registerWorkers(instance)
  await registerSchedules(instance)
  console.log(
    '[queue] started — sync-fanout (4h), weekly-digest (Sun 14:00 UTC), month-condition-notify (daily 14:05 UTC)'
  )
  return instance
}
