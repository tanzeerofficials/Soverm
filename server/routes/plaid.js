/*
 * PLAID ROUTES FILE
 *
 * Plaid is the service that safely connects to banks.
 * Our frontend never touches bank passwords directly.
 * Instead, Plaid opens a secure popup, and our backend talks to Plaid's API.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { plaidClient, syncAllAccountsForUser } from '../services/plaid.js'
import { evaluateAndCreateProactiveNotifications } from '../services/proactiveNotifications.js'
import { scanAndStoreSavingsTransferDetections } from '../services/savingsTransferDetection.js'
import db from '../db/index.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { plaidRateLimiter, syncRateLimiter } from '../middleware/security.js'
import { validatePublicToken, validateUuidParam } from '../utils/validation.js'

const router = Router()

router.use(requireAuth())

router.post('/create-link-token', plaidRateLimiter, async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Soverm',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    })

    res.json({ link_token: response.data.link_token })
  } catch (err) {
    reportServerError('to create Plaid link token', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/exchange-public-token', plaidRateLimiter, async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)

    const tokenCheck = validatePublicToken(req.body?.public_token)
    if (tokenCheck.error) {
      return res.status(400).json({ error: tokenCheck.error })
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: tokenCheck.value,
    })
    const { access_token } = exchangeResponse.data

    const accountsResponse = await plaidClient.accountsBalanceGet({ access_token })
    const { accounts, item } = accountsResponse.data
    const bankName = item.institution_name ?? item.institution_id ?? null

    const itemResult = await db.query(
      `INSERT INTO plaid_items (user_id, plaid_access_token, institution_name, last_synced_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (plaid_access_token) DO UPDATE
         SET institution_name = EXCLUDED.institution_name,
             last_synced_at = NOW()
         WHERE plaid_items.user_id = EXCLUDED.user_id
       RETURNING id`,
      [userId, access_token, bankName]
    )

    if (itemResult.rows.length === 0) {
      return res.status(403).json({
        error: 'This bank connection is already linked to another account.',
      })
    }

    const plaidItemId = itemResult.rows[0].id

    for (const account of accounts) {
      const accountResult = await db.query(
        `INSERT INTO accounts (
          id, user_id, plaid_item_id, plaid_account_id, plaid_access_token,
          bank_name, account_name, account_type,
          balance_current, balance_available, currency
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        ON CONFLICT (plaid_account_id) DO UPDATE SET
          plaid_item_id = EXCLUDED.plaid_item_id,
          plaid_access_token = EXCLUDED.plaid_access_token,
          bank_name = EXCLUDED.bank_name,
          account_name = EXCLUDED.account_name,
          account_type = EXCLUDED.account_type,
          balance_current = EXCLUDED.balance_current,
          balance_available = EXCLUDED.balance_available,
          currency = EXCLUDED.currency,
          plaid_cursor = CASE
            WHEN accounts.plaid_access_token IS DISTINCT FROM EXCLUDED.plaid_access_token
              THEN NULL
            ELSE accounts.plaid_cursor
          END
        WHERE accounts.user_id = EXCLUDED.user_id
        RETURNING id`,
        [
          userId,
          plaidItemId,
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

      if (accountResult.rows.length === 0) {
        return res.status(403).json({
          error: 'One or more accounts are already linked to another user.',
        })
      }
    }

    const { added, modified, removed } = await syncAllAccountsForUser(userId)
    await evaluateAndCreateProactiveNotifications(userId)
    await scanAndStoreSavingsTransferDetections(userId)

    res.json({
      success: true,
      accountsConnected: accounts.length,
      synced: { added, modified, removed },
    })
  } catch (err) {
    reportServerError('to exchange public token and save accounts', err, { userId, req })
    if (err.response?.data) {
      console.error('Plaid error: [redacted from Sentry]')
    }
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/sync-transactions', syncRateLimiter, async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const { added, modified, removed } = await syncAllAccountsForUser(userId)
    await evaluateAndCreateProactiveNotifications(userId)
    await scanAndStoreSavingsTransferDetections(userId)
    res.json({ success: true, added, modified, removed })
  } catch (err) {
    reportServerError('to sync transactions', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.delete('/accounts/:accountId', async (req, res) => {
  const { userId } = getAuth(req)

  const idCheck = validateUuidParam(req.params.accountId, 'accountId')
  if (idCheck.error) {
    return res.status(400).json({ error: idCheck.error })
  }

  const client = await db.connect()

  try {
    const { accountId } = req.params

    const accountResult = await client.query(
      `SELECT a.id, a.plaid_item_id,
              COALESCE(pi.plaid_access_token, a.plaid_access_token) AS plaid_access_token
       FROM accounts a
       LEFT JOIN plaid_items pi ON a.plaid_item_id = pi.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [accountId, userId]
    )

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const { plaid_item_id: plaidItemId, plaid_access_token: accessToken } =
      accountResult.rows[0]

    let isLastAccountOnItem = false

    if (plaidItemId) {
      const remainingResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM accounts
         WHERE plaid_item_id = $1 AND id != $2`,
        [plaidItemId, accountId]
      )
      isLastAccountOnItem = remainingResult.rows[0].count === 0
    } else if (accessToken) {
      const remainingResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM accounts
         WHERE user_id = $1 AND plaid_access_token = $2 AND id != $3`,
        [userId, accessToken, accountId]
      )
      isLastAccountOnItem = remainingResult.rows[0].count === 0
    }

    // Tear down the Plaid Item before local rows — user intent is "stop showing this bank".
    // If Plaid's API fails, still remove our copy of the data.
    if (isLastAccountOnItem && accessToken) {
      try {
        await plaidClient.itemRemove({ access_token: accessToken })
        console.info('Plaid itemRemove succeeded on disconnect')
      } catch (removeErr) {
        reportServerError('to remove Plaid item on disconnect', removeErr, { userId, req })
      }
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

    if (plaidItemId && isLastAccountOnItem) {
      await client.query('DELETE FROM plaid_items WHERE id = $1 AND user_id = $2', [
        plaidItemId,
        userId,
      ])
    }

    await client.query('COMMIT')

    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    reportServerError('to disconnect account', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  } finally {
    client.release()
  }
})

export default router
