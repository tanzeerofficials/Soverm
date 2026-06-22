/*
 * PLAID ROUTES FILE
 *
 * Plaid is the service that safely connects to banks.
 * Our frontend never touches bank passwords directly.
 * Instead, Plaid opens a secure popup, and our backend talks to Plaid's API.
 *
 * Main routes:
 * 1) create-link-token -> gives frontend permission to open Plaid popup
 * 2) exchange-public-token -> turns temporary token into real bank access
 * 3) sync-transactions -> pulls new transactions from Plaid into our database
 * 4) DELETE accounts/:accountId -> disconnect a bank account
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import { plaidClient, syncAllAccountsForUser } from '../services/plaid.js'
import db from '../db/index.js'

const router = Router()

/*
 * POST /api/plaid/create-link-token
 *
 * What it does:
 * - Checks if the user is logged in
 * - Asks Plaid for a short-lived "link token"
 *
 * Why we need it:
 * - The React button needs this token before it can open Plaid Link.
 *
 * How it fits the app:
 * - ConnectBankButton calls this route when the dashboard loads.
 */
router.post('/create-link-token', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Sovrm',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    })

    res.json({ link_token: response.data.link_token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/*
 * POST /api/plaid/exchange-public-token
 *
 * What it does:
 * - Takes the temporary public_token from Plaid popup success
 * - Exchanges it for a long-lived access_token
 * - Fetches bank accounts from Plaid
 * - Saves each account in our database
 *
 * Why we need it:
 * - public_token is temporary and useless by itself.
 * - access_token is what lets us read account balances and transactions later.
 *
 * How it fits the app:
 * - User clicks "Connect Your Bank"
 * - Plaid popup succeeds
 * - Frontend sends public_token here
 * - Backend stores accounts for that logged-in user
 */
router.post('/exchange-public-token', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { public_token } = req.body
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token } = exchangeResponse.data

    const accountsResponse = await plaidClient.accountsGet({ access_token })
    const { accounts, item } = accountsResponse.data
    const bankName = item.institution_name ?? item.institution_id ?? null

    for (const account of accounts) {
      await db.query(
        `INSERT INTO accounts (
          id, user_id, plaid_account_id, plaid_access_token,
          bank_name, account_name, account_type,
          balance_current, balance_available, currency
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
        )`,
        [
          userId,
          account.account_id,
          access_token,
          bankName,
          account.name,
          account.subtype,
          account.balances.current,
          account.balances.available,
          account.balances.iso_currency_code,
        ]
      )
    }

    res.json({ success: true, accountsConnected: accounts.length })
  } catch (err) {
    console.error('Failed to exchange public token and save accounts:', err.message)
    if (err.response?.data) {
      console.error('Plaid error:', err.response.data)
    }
    res.status(500).json({ error: err.message })
  }
})

/*
 * POST /api/plaid/sync-transactions
 *
 * What it does:
 * - Loads every bank account for the logged-in user
 * - Calls Plaid transactionsSync for each account (with pagination)
 * - Inserts new transactions and saves the updated sync cursor
 *
 * Why we need it:
 * - Connecting a bank only stores accounts; this route fills the transactions table
 *
 * How it fits the app:
 * - Dashboard or a cron job can call this to refresh spending data
 */
router.post('/sync-transactions', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { added, modified, removed } = await syncAllAccountsForUser(userId)
    res.json({ success: true, added, modified, removed })
  } catch (err) {
    console.error('Failed to sync transactions:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/*
 * DELETE /api/plaid/accounts/:accountId
 *
 * What it does:
 * - Unlinks transactions from the account (account_id -> NULL)
 * - Removes the connected bank account row (stops future syncs)
 *
 * Why we need it:
 * - Users must be able to revoke access while keeping transaction history
 */
router.delete('/accounts/:accountId', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const client = await db.connect()

  try {
    const { accountId } = req.params

    const accountResult = await client.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    )

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' })
    }

    await client.query('BEGIN')

    await client.query(
      'UPDATE transactions SET account_id = NULL WHERE account_id = $1 AND user_id = $2',
      [accountId, userId]
    )

    await client.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [
      accountId,
      userId,
    ])

    await client.query('COMMIT')

    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Failed to disconnect account:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

export default router
