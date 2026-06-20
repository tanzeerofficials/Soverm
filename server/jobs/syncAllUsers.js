/*
 * SCHEDULED SYNC JOB
 *
 * Periodically syncs Plaid transactions for every user
 * who has connected a bank account.
 */

import cron from 'node-cron'
import db from '../db/index.js'
import { syncAllAccountsForUser } from '../services/plaid.js'

export function startSyncJob() {
  // TESTING ONLY — change back to '0 */4 * * *' after testing (every 4 hours)
  cron.schedule('0 */4 * * *', async () => {
    console.log('Starting scheduled sync for all users...')

    try {
      const usersResult = await db.query('SELECT DISTINCT user_id FROM accounts')
      const userIds = usersResult.rows.map((row) => row.user_id)

      for (const userId of userIds) {
        try {
          const { added, modified, removed } = await syncAllAccountsForUser(userId)
          console.log(
            `Synced for user ${userId}: ${added} added, ${modified} modified, ${removed} removed`
          )
        } catch (userErr) {
          console.error(`Scheduled sync failed for user ${userId}:`, userErr.message)
        }
      }

      console.log('Scheduled sync complete')
    } catch (err) {
      console.error('Scheduled sync failed:', err.message)
    }
  })
}
