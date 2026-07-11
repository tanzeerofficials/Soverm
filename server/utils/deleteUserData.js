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
 * - Collects access tokens from both plaid_items and legacy accounts rows
 * - Deletes the user row (CASCADE clears related tables where configured)
 * - Calls Plaid itemRemove for every unique token after the DB commit
 *
 * Why we need both token sources:
 * - Older links may still store plaid_access_token on accounts without a
 *   plaid_items row. Skipping those would leave a live bank link at Plaid.
 */

import db from '../db/index.js'
import { plaidClient } from '../services/plaid.js'

export async function deleteAllUserData(userId) {
  const client = await db.connect()
  const accessTokens = new Set()

  try {
    const itemsResult = await client.query(
      `SELECT plaid_access_token FROM plaid_items WHERE user_id = $1`,
      [userId]
    )
    for (const row of itemsResult.rows) {
      if (row.plaid_access_token) {
        accessTokens.add(row.plaid_access_token)
      }
    }

    const legacyAccountsResult = await client.query(
      `SELECT plaid_access_token
       FROM accounts
       WHERE user_id = $1
         AND plaid_access_token IS NOT NULL`,
      [userId]
    )
    for (const row of legacyAccountsResult.rows) {
      if (row.plaid_access_token) {
        accessTokens.add(row.plaid_access_token)
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
