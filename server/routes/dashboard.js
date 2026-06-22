/*
 * DASHBOARD ROUTES FILE
 *
 * Aggregates accounts, balances, spending, and latest insight
 * into one response for the dashboard page.
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import db from '../db/index.js'

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

function calculateTotalBalance(accounts) {
  return accounts.reduce((total, account) => {
    const balance = Number(account.balance_available) || 0
    if (account.account_type?.toLowerCase().includes('credit')) {
      return total - balance
    }
    return total + balance
  }, 0)
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

    const accountsResult = await db.query(
      `SELECT id, bank_name, account_name, account_type,
              balance_current, balance_available, currency
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    )

    const accounts = accountsResult.rows
    const totalBalance = calculateTotalBalance(accounts)

    const incomeResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount < 0
         AND date >= NOW() - $2::interval`,
      [userId, interval]
    )

    const spentResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount > 0
         AND date >= NOW() - $2::interval`,
      [userId, interval]
    )

    const insightResult = await db.query(
      `SELECT id, content, created_at
       FROM insights
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )

    const income = Math.abs(Number(incomeResult.rows[0].total))
    const spent = Number(spentResult.rows[0].total)
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

    const lastSyncedResult = await db.query(
      `SELECT MAX(last_synced_at) AS last_synced
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    )

    const lastSyncedAt = lastSyncedResult.rows[0].last_synced ?? null

    res.json({
      totalBalance,
      income,
      spent,
      accounts,
      latestInsight,
      lastSyncedAt,
      appliedRange,
    })
  } catch (err) {
    console.error('Failed to load dashboard summary:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
