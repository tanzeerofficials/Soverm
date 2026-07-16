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
import {
  CASH_OUT_NAME_PATTERN,
  DEPOSIT_NAME_PATTERN,
  PAYROLL_INCOME_NAME_PATTERN,
} from '../utils/cashFlowClassification.js'
import {
  CASH_OUT_CATEGORY_LABEL,
  PEER_TRANSFER_CATEGORY_LABEL,
  resolvePlaidTransactionCategory,
  SELF_DEPOSIT_CATEGORY_LABEL,
  SELF_TRANSFER_CATEGORY_LABEL,
} from '../utils/plaidCategory.js'

function formatBackfillDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/*
 * correctPeerPaymentCategoriesForUser(userId)
 *
 * What it does: rewrites stored categories for Zelle/Venmo/etc. to Peer transfer.
 * Why: Plaid often mislabels person-to-person sends (e.g. Personal Care).
 * Runs on each sync so existing rows fix without waiting for a Plaid update.
 */
async function correctPeerPaymentCategoriesForUser(userId) {
  const result = await db.query(
    `UPDATE transactions
     SET category = $2
     WHERE user_id = $1
       AND category IS DISTINCT FROM $2
       AND (
         name ILIKE '%zelle%'
         OR name ILIKE '%venmo%'
         OR name ILIKE '%cash app%'
         OR name ILIKE '%cashapp%'
         OR name ILIKE '%paypal%'
         OR name ILIKE '%taptap%'
         OR name ILIKE '%tap tap%'
         OR name ILIKE '%remitly%'
         OR name ILIKE '%western union%'
         OR name ILIKE '%apple cash%'
         OR name ILIKE '%google pay%'
         OR name ILIKE '%wise%'
       )`,
    [userId, PEER_TRANSFER_CATEGORY_LABEL]
  )
  return result.rowCount ?? 0
}

/*
 * correctSelfDepositCategoriesForUser(userId)
 *
 * What it does: rewrites ATM / mobile / check deposit credits to "Self deposit".
 * Why: banks/Plaid often store those as Transfer; we want a clear Money-in bucket.
 */
async function correctSelfDepositCategoriesForUser(userId) {
  const result = await db.query(
    `UPDATE transactions
     SET category = $2
     WHERE user_id = $1
       AND amount < 0
       AND category IS DISTINCT FROM $2
       AND COALESCE(name, '') ~* $3
       AND COALESCE(name, '') !~* $4`,
    [
      userId,
      SELF_DEPOSIT_CATEGORY_LABEL,
      DEPOSIT_NAME_PATTERN,
      PAYROLL_INCOME_NAME_PATTERN,
    ]
  )
  return result.rowCount ?? 0
}

/*
 * correctMislabeledPayrollSelfDepositsForUser(userId)
 *
 * What it does: undoes Self deposit on paycheck / direct-deposit credits.
 * Why: an earlier matcher treated "DIRECT DEPOSIT" like an ATM deposit.
 */
async function correctMislabeledPayrollSelfDepositsForUser(userId) {
  const result = await db.query(
    `UPDATE transactions
     SET category = 'Income'
     WHERE user_id = $1
       AND amount < 0
       AND category = $2
       AND COALESCE(name, '') ~* $3`,
    [userId, SELF_DEPOSIT_CATEGORY_LABEL, PAYROLL_INCOME_NAME_PATTERN]
  )
  return result.rowCount ?? 0
}

/*
 * correctCashOutCategoriesForUser(userId)
 *
 * What it does: rewrites ATM / cash withdrawals to "Cash out".
 * Why: those often look like Transfer; users need to see cash leaving the bank.
 */
async function correctCashOutCategoriesForUser(userId) {
  const result = await db.query(
    `UPDATE transactions
     SET category = $2
     WHERE user_id = $1
       AND amount > 0
       AND category IS DISTINCT FROM $2
       AND (
         COALESCE(name, '') ~* $3
         OR COALESCE(category, '') ~* '\\batm\\b'
       )`,
    [userId, CASH_OUT_CATEGORY_LABEL, CASH_OUT_NAME_PATTERN]
  )
  return result.rowCount ?? 0
}

/*
 * correctLegacyTransferCategoriesForUser(userId)
 *
 * What it does: renames leftover vague "Transfer" labels to "Self transfer".
 * Why: after peer / deposit / cash-out fixes, remaining transfers are own-account moves.
 */
async function correctLegacyTransferCategoriesForUser(userId) {
  const result = await db.query(
    `UPDATE transactions
     SET category = $2
     WHERE user_id = $1
       AND category IS DISTINCT FROM $2
       AND COALESCE(category, '') ~* 'transfer'
       AND COALESCE(category, '') !~* 'peer transfer'
       AND COALESCE(category, '') !~* 'self deposit'
       AND COALESCE(category, '') !~* 'self transfer'
       AND COALESCE(category, '') !~* 'cash out'`,
    [userId, SELF_TRANSFER_CATEGORY_LABEL]
  )
  return result.rowCount ?? 0
}

/*
 * backfillMissingCategoriesForItem(accessToken, userId)
 *
 * Fetches recent Plaid transactions and fills category on rows that were
 * stored before personal_finance_category support existed.
 */
async function backfillMissingCategoriesForItem(accessToken, userId) {
  const endDate = formatBackfillDate(new Date())
  const start = new Date()
  start.setDate(start.getDate() - 90)
  const startDate = formatBackfillDate(start)

  let offset = 0
  let backfilled = 0

  while (true) {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        offset,
        count: 500,
        include_personal_finance_category: true,
      },
    })

    const transactions = response.data.transactions ?? []

    for (const transaction of transactions) {
      const category = resolvePlaidTransactionCategory(transaction)
      if (!category) {
        continue
      }

      const updateResult = await db.query(
        `UPDATE transactions
         SET category = $1
         WHERE plaid_transaction_id = $2
           AND user_id = $3
           AND category IS NULL`,
        [category, transaction.transaction_id, userId]
      )
      backfilled += updateResult.rowCount
    }

    if (transactions.length < 500) {
      break
    }

    offset += transactions.length
  }

  return backfilled
}

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
      options: {
        personal_finance_category_version: 'v2',
      },
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
 * - Groups DB account rows by plaid_access_token (one Plaid Item per token)
 * - Syncs transactions once per Item, not once per sub-account row
 * - Applies added, modified, and removed changes for all sub-accounts in that Item
 * - Refreshes balances via one accountsBalanceGet call per Item
 * - Writes the same plaid_cursor to every sibling row sharing that token
 *
 * Why we need it:
 * - Shared by the /sync-transactions route and scheduled cron jobs
 * - Plaid's transactionsSync and accountsBalanceGet are Item-scoped APIs
 *
 * How it fits the app:
 * - Called when a user clicks Sync or when a nightly job runs for all users
 */
function groupAccountsByPlaidItem(accounts) {
  const groups = new Map()

  for (const account of accounts) {
    const itemKey = account.plaid_item_id ?? account.plaid_access_token
    if (!groups.has(itemKey)) {
      groups.set(itemKey, {
        plaidItemId: account.plaid_item_id,
        accessToken: account.plaid_access_token,
        cursor: account.plaid_cursor,
        accounts: [],
      })
    }
    groups.get(itemKey).accounts.push(account)
  }

  return groups
}

export async function syncAllAccountsForUser(userId) {
  const counts = { added: 0, modified: 0, removed: 0, categoriesBackfilled: 0 }

  try {
    const accountsResult = await db.query(
      `SELECT a.id, a.plaid_account_id,
              COALESCE(pi.plaid_access_token, a.plaid_access_token) AS plaid_access_token,
              COALESCE(pi.plaid_cursor, a.plaid_cursor) AS plaid_cursor,
              pi.id AS plaid_item_id
       FROM accounts a
       LEFT JOIN plaid_items pi ON a.plaid_item_id = pi.id
       WHERE a.user_id = $1`,
      [userId]
    )

    const itemGroups = groupAccountsByPlaidItem(accountsResult.rows)

    for (const [, itemGroup] of itemGroups) {
      const { plaidItemId, accessToken, accounts: groupAccounts } = itemGroup
      const cursor = itemGroup.cursor ?? null

      try {
        const accountByPlaidId = new Map(
          groupAccounts.map((account) => [account.plaid_account_id, account])
        )

        let syncResult = await syncTransactionsForAccount(accessToken, cursor)
        const allRemoved = [...syncResult.removed]
        const allModified = [...syncResult.modified]
        const allAdded = [...syncResult.added]

        while (syncResult.hasMore) {
          syncResult = await syncTransactionsForAccount(
            accessToken,
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
          const dbAccount = accountByPlaidId.get(transaction.account_id)
          if (!dbAccount) {
            continue
          }

          const updateResult = await db.query(
            `UPDATE transactions
             SET amount = $1, name = $2, category = $3, date = $4, pending = $5
             WHERE plaid_transaction_id = $6 AND user_id = $7`,
            [
              transaction.amount,
              transaction.name,
              resolvePlaidTransactionCategory(transaction),
              transaction.date,
              transaction.pending,
              transaction.transaction_id,
              userId,
            ]
          )
          counts.modified += updateResult.rowCount
        }

        for (const transaction of allAdded) {
          const dbAccount = accountByPlaidId.get(transaction.account_id)
          if (!dbAccount) {
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
              dbAccount.id,
              transaction.transaction_id,
              transaction.amount,
              transaction.name,
              resolvePlaidTransactionCategory(transaction),
              transaction.date,
              transaction.pending,
            ]
          )
          counts.added += insertResult.rowCount
        }

        const accountsResponse = await plaidClient.accountsBalanceGet({
          access_token: accessToken,
        })

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

        if (plaidItemId) {
          await db.query(
            `UPDATE plaid_items
             SET plaid_cursor = $1, last_synced_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [syncResult.nextCursor, plaidItemId, userId]
          )
        }

        await db.query(
          `UPDATE accounts
           SET plaid_cursor = $1, last_synced_at = NOW()
           WHERE user_id = $2 AND plaid_access_token = $3`,
          [syncResult.nextCursor, userId, accessToken]
        )

        try {
          counts.categoriesBackfilled += await backfillMissingCategoriesForItem(
            accessToken,
            userId
          )
        } catch (backfillErr) {
          console.warn(
            `Category backfill skipped for user ${userId}:`,
            backfillErr.response?.data?.error_message ?? backfillErr.message
          )
        }
      } catch (itemErr) {
        console.error(
          `Failed to sync Plaid item for user ${userId} (${groupAccounts.length} account(s)):`,
          itemErr.message
        )
        counts.itemErrors = (counts.itemErrors ?? 0) + 1
        counts.partial = true
      }
    }

    try {
      counts.peerCategoriesCorrected = await correctPeerPaymentCategoriesForUser(userId)
    } catch (peerErr) {
      console.warn(
        `Peer category correction skipped for user ${userId}:`,
        peerErr.message
      )
    }

    try {
      counts.selfDepositCategoriesCorrected =
        await correctSelfDepositCategoriesForUser(userId)
      counts.payrollSelfDepositCorrections =
        await correctMislabeledPayrollSelfDepositsForUser(userId)
    } catch (depositErr) {
      console.warn(
        `Self deposit category correction skipped for user ${userId}:`,
        depositErr.message
      )
    }

    try {
      counts.cashOutCategoriesCorrected =
        await correctCashOutCategoriesForUser(userId)
    } catch (cashOutErr) {
      console.warn(
        `Cash out category correction skipped for user ${userId}:`,
        cashOutErr.message
      )
    }

    try {
      counts.legacyTransferCategoriesCorrected =
        await correctLegacyTransferCategoriesForUser(userId)
    } catch (legacyErr) {
      console.warn(
        `Legacy transfer category correction skipped for user ${userId}:`,
        legacyErr.message
      )
    }

    return counts
  } catch (err) {
    console.error(`Failed to sync accounts for user ${userId}:`, err.message)
    throw err
  }
}
