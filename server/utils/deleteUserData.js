/*
 * DELETE USER DATA
 *
 * Removes every row tied to a user from Postgres, then revokes Plaid Items.
 * Used by DELETE /api/user for account deletion requests.
 *
 * Privacy policy: keep client/src/pages/PrivacyPage.jsx "What account deletion
 * removes" section in sync if tables or behavior here change.
 */

import db from '../db/index.js'
import { plaidClient } from '../services/plaid.js'

export async function deleteAllUserData(userId) {
  const client = await db.connect()

  const itemsResult = await client.query(
    `SELECT plaid_access_token FROM plaid_items WHERE user_id = $1`,
    [userId]
  )
  const accessTokens = itemsResult.rows
    .map((row) => row.plaid_access_token)
    .filter(Boolean)

  try {
    await client.query('BEGIN')

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
