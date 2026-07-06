/*
 * DASHBOARD ROUTES FILE
 *
 * Aggregates accounts, balances, spending, and latest insight
 * into one response for the dashboard page.
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

const router = Router()

function parseLatestInsight(row) {
  let parsedContent

  try {
    parsedContent = JSON.parse(row.content)
  } catch {
    parsedContent = {
      headline: 'Previous insight',
      fullSummary: row.content,
      stats: [],
    }
  }

  return { ...parsedContent, id: row.id, created_at: row.created_at }
}

const DEFAULT_RANGE = '30d'

const RANGE_INTERVALS = {
  '7d': '7 days',
  '30d': '30 days',
  '3m': '3 months',
  '1y': '1 year',
}

function resolveRange(rangeParam) {
  if (typeof rangeParam === 'string' && rangeParam in RANGE_INTERVALS) {
    return rangeParam
  }
  return DEFAULT_RANGE
}

/*
 * GET /api/dashboard/summary
 *
 * What it does:
 * - Loads accounts, income/spend totals for a time range, and latest insight
 * - Accepts ?range=7d|30d|3m|1y (defaults to 30d)
 * - Returns everything the dashboard needs in one JSON payload
 *
 * Why one route:
 * - The dashboard renders all sections together; one call is faster
 *   and avoids partial loading states across multiple requests
 */
router.get('/summary', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const appliedRange = resolveRange(req.query.range)
    const interval = RANGE_INTERVALS[appliedRange]

    const [accountsResult, incomeResult, spentResult, spendingSeriesResult, insightResult, lastSyncedResult] =
      await Promise.all([
    db.query(
      `SELECT id, bank_name, account_name, account_type,
              balance_current, balance_available, currency
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount < 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $2::interval`,
      [userId, interval]
    ),
    db.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $2::interval`,
      [userId, interval]
    ),
    db.query(
      `SELECT t.date::date AS date, COALESCE(SUM(t.amount), 0)::numeric AS amount
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $2::interval
       GROUP BY t.date::date
       ORDER BY t.date::date ASC`,
      [userId, interval]
    ),
    db.query(
      `SELECT id, content, created_at
       FROM insights
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    ),
    db.query(
      `SELECT MAX(last_synced_at) AS last_synced
       FROM (
         SELECT last_synced_at FROM accounts WHERE user_id = $1
         UNION ALL
         SELECT last_synced_at FROM plaid_items WHERE user_id = $1
       ) AS combined
       WHERE last_synced_at IS NOT NULL`,
      [userId]
    ),
  ])

    const accounts = accountsResult.rows.map((account) => ({
      ...account,
      displayBalance: getDisplayBalance(account),
    }))
    const totalBalance = calculateTotalBalance(accounts)

    const income = Number(incomeResult.rows[0].total)
    const spent = Number(spentResult.rows[0].total)
    const spendingSeries = spendingSeriesResult.rows.map((row) => ({
      date: row.date,
      amount: Number(row.amount),
    }))
    const insightRow = insightResult.rows[0]

    let latestInsight = null
    if (insightRow) {
      const actionsResult = await db.query(
        `SELECT id, description, completed
         FROM actions
         WHERE insight_id = $1
         ORDER BY created_at ASC`,
        [insightRow.id]
      )

      latestInsight = {
        ...parseLatestInsight(insightRow),
        actions: actionsResult.rows,
      }
    }

    const lastSyncedAt = lastSyncedResult.rows[0].last_synced ?? null

    res.json({
      totalBalance,
      income,
      spent,
      spendingSeries,
      accounts,
      latestInsight,
      lastSyncedAt,
      appliedRange,
    })
  } catch (err) {
    reportServerError('to load dashboard summary', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
