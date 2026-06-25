/*
 * PLAID CLIENT SETUP
 *
 * This file creates one shared Plaid "remote control" (plaidClient)
 * that every route can reuse.
 *
 * Why not create a new Plaid client in every route?
 * - Because we would repeat the same setup code over and over.
 * - One shared client is cleaner and easier to maintain.
 *
 * Environment variables used here:
 * - PLAID_ENV -> sandbox or production
 * - PLAID_CLIENT_ID -> who we are when talking to Plaid
 * - PLAID_SECRET -> secret password for Plaid API
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import db from '../db/index.js'

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

/*
 * syncTransactionsForAccount(accessToken, cursor)
 *
 * What it does:
 * - Calls Plaid's transactionsSync for one bank connection
 * - Returns one page of changes: new, updated, and deleted transactions
 *
 * Why we need it:
 * - Keeps our transactions table in sync without re-downloading full history
 * - Callers loop while hasMore is true, then save nextCursor to the DB
 *
 * How it fits the app:
 * - Routes or jobs load access_token + plaid_cursor from accounts,
 *   call this function, apply the changes, and persist the new cursor
 */
export async function syncTransactionsForAccount(accessToken, cursor) {
  try {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor || undefined,
    })

    const { added, modified, removed, next_cursor, has_more } = response.data

    return {
      added,
      modified,
      removed,
      nextCursor: next_cursor,
      hasMore: has_more,
    }
  } catch (err) {
    const plaidMessage = err.response?.data?.error_message
    throw new Error(
      plaidMessage
        ? `Plaid transactionsSync failed: ${plaidMessage}`
        : `Plaid transactionsSync failed: ${err.message}`
    )
  }
}

/*
 * syncAllAccountsForUser(userId)
 *
 * What it does:
 * - Syncs transactions for every bank account belonging to one user
 * - Applies added, modified, and removed changes from Plaid
 * - Refreshes account balances via accountsGet
 * - Updates each account's plaid_cursor and last_synced_at
 *
 * Why we need it:
 * - Shared by the /sync-transactions route and scheduled cron jobs
 * - Keeps sync logic in one place instead of duplicating it in routes
 *
 * How it fits the app:
 * - Called when a user clicks Sync or when a nightly job runs for all users
 */
export async function syncAllAccountsForUser(userId) {
  const counts = { added: 0, modified: 0, removed: 0 }

  try {
    const accountsResult = await db.query(
      `SELECT id, plaid_access_token, plaid_cursor, plaid_account_id
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    )

    for (const account of accountsResult.rows) {
      try {
        let syncResult = await syncTransactionsForAccount(
          account.plaid_access_token,
          account.plaid_cursor
        )
        const allRemoved = [...syncResult.removed]
        const allModified = [...syncResult.modified]
        const allAdded = [...syncResult.added]

        while (syncResult.hasMore) {
          syncResult = await syncTransactionsForAccount(
            account.plaid_access_token,
            syncResult.nextCursor
          )
          allRemoved.push(...syncResult.removed)
          allModified.push(...syncResult.modified)
          allAdded.push(...syncResult.added)
        }

        for (const removed of allRemoved) {
          const deleteResult = await db.query(
            `DELETE FROM transactions
             WHERE plaid_transaction_id = $1 AND user_id = $2`,
            [removed.transaction_id, userId]
          )
          counts.removed += deleteResult.rowCount
        }

        for (const transaction of allModified) {
          if (transaction.account_id !== account.plaid_account_id) {
            continue
          }

          const updateResult = await db.query(
            `UPDATE transactions
             SET amount = $1, name = $2, category = $3, date = $4, pending = $5
             WHERE plaid_transaction_id = $6 AND user_id = $7`,
            [
              transaction.amount,
              transaction.name,
              transaction.category ? transaction.category[0] : null,
              transaction.date,
              transaction.pending,
              transaction.transaction_id,
              userId,
            ]
          )
          counts.modified += updateResult.rowCount
        }

        for (const transaction of allAdded) {
          if (transaction.account_id !== account.plaid_account_id) {
            continue
          }

          const insertResult = await db.query(
            `INSERT INTO transactions (
              id, user_id, account_id, plaid_transaction_id,
              amount, name, category, date, pending
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
            )
            ON CONFLICT (plaid_transaction_id) DO NOTHING`,
            [
              userId,
              account.id,
              transaction.transaction_id,
              transaction.amount,
              transaction.name,
              transaction.category ? transaction.category[0] : null,
              transaction.date,
              transaction.pending,
            ]
          )
          counts.added += insertResult.rowCount
        }

        const accountsResponse = await plaidClient.accountsGet({
          access_token: account.plaid_access_token,
        })

        console.log(
          '[Plaid accountsGet raw]',
          JSON.stringify(accountsResponse.data.accounts, null, 2)
        )

        for (const plaidAccount of accountsResponse.data.accounts) {
          await db.query(
            `UPDATE accounts
             SET balance_current = $1,
                 balance_available = $2,
                 last_synced_at = NOW()
             WHERE plaid_account_id = $3 AND user_id = $4`,
            [
              plaidAccount.balances.current,
              plaidAccount.balances.available,
              plaidAccount.account_id,
              userId,
            ]
          )
        }

        await db.query(
          'UPDATE accounts SET plaid_cursor = $1, last_synced_at = NOW() WHERE id = $2',
          [syncResult.nextCursor, account.id]
        )
      } catch (accountErr) {
        console.error(
          `Failed to sync account ${account.id} for user ${userId}:`,
          accountErr.message
        )
      }
    }

    return counts
  } catch (err) {
    console.error(`Failed to sync accounts for user ${userId}:`, err.message)
    throw err
  }
}
