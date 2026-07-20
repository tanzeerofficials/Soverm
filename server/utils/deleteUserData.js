/*
 * DELETE USER DATA
 *
 * Removes every row tied to a user from Postgres, then revokes Plaid Items.
 * Used by DELETE /api/user for account deletion requests.
 *
 * Privacy policy: keep client/src/pages/PrivacyPage.jsx "What account deletion
 * removes" section in sync if tables or behavior here change.
 *
 * What it does:
 * - Cancels any active Stripe subscription (best-effort) before wiping rows
 * - Collects access tokens from plaid_items
 * - Deletes the user row (CASCADE clears related tables where configured)
 * - Calls Plaid itemRemove for every unique token after the DB commit
 */

import db from '../db/index.js'
import { plaidClient } from '../services/plaid.js'
import { cancelStripeSubscriptionsForUser } from '../services/stripeBilling.js'
import { decryptAccessToken } from './tokenCrypto.js'

export async function deleteAllUserData(userId) {
  /*
   * Cancel Stripe first so deleting the users row does not leave a live
   * subscription charging a deleted account. Failures are swallowed inside
   * the helper — account deletion must still proceed.
   */
  try {
    await cancelStripeSubscriptionsForUser(userId)
  } catch (err) {
    console.error('Stripe cancel during account deletion failed:', err.message)
  }

  const client = await db.connect()
  const accessTokens = new Set()

  try {
    const itemsResult = await client.query(
      `SELECT plaid_access_token FROM plaid_items WHERE user_id = $1`,
      [userId]
    )
    for (const row of itemsResult.rows) {
      if (row.plaid_access_token) {
        accessTokens.add(decryptAccessToken(row.plaid_access_token))
      }
    }

    await client.query('BEGIN')

    // Explicit deletes keep the purge order clear; CASCADE on users also covers
    // notifications / trackers / detections / narratives when those FKs exist.
    await client.query('DELETE FROM chat_messages WHERE user_id = $1', [userId])
    await client.query('DELETE FROM actions WHERE user_id = $1', [userId])
    await client.query('DELETE FROM insights WHERE user_id = $1', [userId])
    await client.query('DELETE FROM transactions WHERE user_id = $1', [userId])
    await client.query('DELETE FROM accounts WHERE user_id = $1', [userId])
    await client.query('DELETE FROM plaid_items WHERE user_id = $1', [userId])
    await client.query('DELETE FROM users WHERE id = $1', [userId])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  for (const accessToken of accessTokens) {
    try {
      await plaidClient.itemRemove({ access_token: accessToken })
    } catch (removeErr) {
      console.error('Plaid itemRemove failed during account deletion:', removeErr.message)
    }
  }
}
