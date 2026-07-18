/*
 * DASHBOARD ROUTES FILE
 *
 * Aggregates accounts, balances, spending, and latest insight
 * into one response for the dashboard page.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import {
  calculateTotalBalance,
  getCreditAvailable,
  getCreditSpent,
  getDisplayBalance,
  isCreditAccount,
} from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS, EXPENSE_ANALYZER_TRANSACTION_SELECT } from '../utils/connectedAccountTransactions.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
  summarizeCashFlow,
} from '../utils/transactionFilters.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { buildCashFlowForecastForUser } from '../services/cashFlowForecast.js'
import { calendarMonthSqlBounds, getAppTodayIso } from '../utils/calendarMonth.js'

const router = Router()

router.use(requireAuth())

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

/*
 * Fixed day counts (not calendar months/years) so SQL totals match the
 * client sparkline, which always fills exactly 7 / 30 / 90 / 365 days.
 * `mtd` is special: current calendar month (same window as the Month letter).
 */
const RANGE_INTERVALS = {
  '7d': '7 days',
  '30d': '30 days',
  '3m': '90 days',
  '1y': '365 days',
}

function resolveRange(rangeParam) {
  if (rangeParam === 'mtd') {
    return 'mtd'
  }
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
 * - Accepts ?range=mtd|7d|30d|3m|1y (defaults to 30d)
 * - `mtd` = calendar month so far (aligned with Month letter)
 * - External money in/out exclude own-account transfers and credit-card payments
 * - Also returns a cashFlow breakdown (byKind) so the UI can show sources
 * - Returns everything the dashboard needs in one JSON payload
 *
 * Why one route:
 * - The dashboard renders all sections together; one call is faster
 *   and avoids partial loading states across multiple requests
 */
router.get('/summary', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const appliedRange = resolveRange(req.query.range)
    const useMonthToDate = appliedRange === 'mtd'
    const interval = useMonthToDate ? null : RANGE_INTERVALS[appliedRange]
    const monthBounds = calendarMonthSqlBounds()

    const dateFilterSql = useMonthToDate
      ? `AND t.date >= $2::date AND t.date < $3::date`
      : `AND t.date >= NOW() - $2::interval`
    const dateFilterParams = useMonthToDate
      ? [userId, monthBounds.startIso, monthBounds.endExclusiveIso]
      : [userId, interval]

    const [
      accountsResult,
      spendingSeriesResult,
      ledgerResult,
      insightResult,
      lastSyncedResult,
    ] = await Promise.all([
      db.query(
        `SELECT id, bank_name, account_name, account_type,
                balance_current, balance_available, currency
         FROM accounts
         WHERE user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT t.date::date AS date, COALESCE(SUM(t.amount), 0)::numeric AS amount
         FROM transactions t
         ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
         WHERE t.user_id = $1
           AND t.amount > 0
           ${NON_PENDING_FILTER}
           ${EXCLUDE_INTERNAL_MOVES_FILTER}
           ${dateFilterSql}
         GROUP BY t.date::date
         ORDER BY t.date::date ASC`,
        dateFilterParams
      ),
      db.query(
        `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
         FROM transactions t
         ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
         WHERE t.user_id = $1
           ${NON_PENDING_FILTER}
           ${dateFilterSql}
         ORDER BY t.date DESC`,
        dateFilterParams
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

    const accounts = accountsResult.rows.map((account) => {
      const enriched = {
        ...account,
        displayBalance: getDisplayBalance(account),
      }

      // Credit cards: expose spent (owed) + available credit for the account list UI.
      // Loans/mortgages stay displayBalance-only — available is not "credit left".
      if (isCreditAccount(account)) {
        enriched.creditSpent = getCreditSpent(account)
        enriched.creditAvailable = getCreditAvailable(account)
      }

      return enriched
    })
    const totalBalance = calculateTotalBalance(accounts)

    // One classifier for the whole ledger window: Money in/out are external
    // only; own-account transfers and card payments stay in byKind separately.
    const cashFlow = summarizeCashFlow(ledgerResult.rows, { activityLimit: 24 })
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
         WHERE insight_id = $1 AND user_id = $2
         ORDER BY created_at ASC`,
        [insightRow.id, userId]
      )

      latestInsight = {
        ...parseLatestInsight(insightRow),
        actions: actionsResult.rows,
      }
    }

    const lastSyncedAt = lastSyncedResult.rows[0].last_synced ?? null

    res.json({
      totalBalance,
      income: cashFlow.moneyIn,
      spent: cashFlow.moneyOut,
      cashFlow: {
        moneyIn: cashFlow.moneyIn,
        moneyOut: cashFlow.moneyOut,
        net: cashFlow.net,
        byKind: cashFlow.byKind,
        selfTransfers: cashFlow.selfTransfers,
        internalMoved: cashFlow.internalMoved,
        liabilityPayments: cashFlow.liabilityPayments,
        activity: cashFlow.activity,
      },
      spendingSeries,
      accounts,
      latestInsight,
      lastSyncedAt,
      appliedRange,
      todayIso: getAppTodayIso(),
      periodStart: monthBounds.startIso,
      periodEndExclusive: monthBounds.endExclusiveIso,
    })
  } catch (err) {
    reportServerError('to load dashboard summary', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * GET /api/dashboard/forecast
 *
 * Projects net balance for the next 30 days using confirmed recurring
 * charges and recent income/spending patterns.
 */
router.get('/forecast', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const forecast = await buildCashFlowForecastForUser(userId)
    res.json(forecast)
  } catch (err) {
    reportServerError('to load cash flow forecast', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
