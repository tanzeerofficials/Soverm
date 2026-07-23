/*
 * MANUAL SYNC ENQUEUE (ops / verification helper)
 *
 * Pushes a sync-user job onto the queue for one user without waiting for a
 * Plaid webhook or the 4-hour fanout schedule — useful to verify the queue
 * end-to-end (see README "Verifying the queue") or to force-refresh a user
 * that reported stale data.
 *
 * Usage:
 *   node scripts/enqueue-sync.js <userId>
 *
 * This only enqueues — it does NOT start a worker. Run `npm run dev` (or
 * `npm run worker`) in another terminal so something actually picks it up.
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const userId = process.argv[2]

if (!userId) {
  console.error('Usage: node scripts/enqueue-sync.js <userId>')
  process.exit(1)
}

const { getBoss, enqueueUserSync, stopQueue } = await import('../queue/boss.js')

try {
  // send() requires an open connection — start() also runs pg-boss's own
  // schema migrations on first use against a fresh database.
  await getBoss().start()

  const jobId = await enqueueUserSync({ userId })

  if (jobId) {
    console.log(`Enqueued sync-user job ${jobId} for ${userId}.`)
  } else {
    console.log(
      `No job created — a sync-user job for ${userId} is already queued or active (policy 'exclusive').`
    )
  }
} finally {
  await stopQueue()
}

process.exit(0)
