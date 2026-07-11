/*
 * SCHEDULED SYNC JOB
 *
 * Periodically syncs Plaid transactions for every user
 * who has connected a bank account.
 */

import cron from 'node-cron'
import db from '../db/index.js'
import { syncAllAccountsForUser } from '../services/plaid.js'
import { evaluateAndCreateProactiveNotifications } from '../services/proactiveNotifications.js'
import { scanAndStoreSavingsTransferDetections } from '../services/savingsTransferDetection.js'

let syncRunning = false

export function startSyncJob() {
  // Every 4 hours. Skip if a previous run is still in progress.
  cron.schedule('0 */4 * * *', async () => {
    if (syncRunning) {
      console.warn('Scheduled sync skipped — previous run still in progress')
      return
    }

    syncRunning = true
    console.log('Starting scheduled sync for all users...')

    try {
      const usersResult = await db.query('SELECT DISTINCT user_id FROM accounts')
      const userIds = usersResult.rows.map((row) => row.user_id)

      for (const userId of userIds) {
        try {
          const { added, modified, removed, partial } = await syncAllAccountsForUser(userId)
          console.log(
            `Synced for user ${userId}: ${added} added, ${modified} modified, ${removed} removed${
              partial ? ' (partial)' : ''
            }`
          )

          const notificationResult = await evaluateAndCreateProactiveNotifications(userId)
          if (notificationResult.created > 0) {
            console.log(
              `Created ${notificationResult.created} proactive notification(s) for user ${userId}`
            )
          }

          const savingsResult = await scanAndStoreSavingsTransferDetections(userId)
          if (savingsResult.created > 0) {
            console.log(
              `Detected ${savingsResult.created} savings transfer(s) for user ${userId}`
            )
          }
        } catch (userErr) {
          console.error(`Scheduled sync failed for user ${userId}:`, userErr.message)
        }
      }

      console.log('Scheduled sync complete')
    } catch (err) {
      console.error('Scheduled sync failed:', err.message)
    } finally {
      syncRunning = false
    }
  })
}
