import db from '../db/index.js'
import { getDisplayBalance } from './balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from './connectedAccountTransactions.js'

export { normalizeMerchantName } from './merchantNormalize.js'

// Shared rolling window for insight transaction context and month-over-month comparison.
export const COMPARISON_PERIOD_INTERVAL = '30 days'
export const RECURRING_CHARGE_LOOKBACK_INTERVAL = '3 months'

const NON_PENDING_FILTER = 'AND (pending IS NOT TRUE)'

function buildCategoryTotals(rows) {
  const byCategory = {}

  for (const row of rows) {
    const category = row.category || 'Uncategorized'
    byCategory[category] = Number(row.total)
  }

  return byCategory
}

// Minimum absolute MoM percent change before a category counts as a "top mover" in UI copy.
export const SIGNIFICANT_CATEGORY_CHANGE_PERCENT = 5

/**
 * Computes month-over-month direction and percent for a spending (or income) pair.
 * Shared by insight delta enforcement and the Expense Analyzer category breakdown.
 */
export function computeSpendingDelta(current, prior) {
  if (prior === 0) {
    if (current === 0) {
      return { direction: 'flat', percent: 0, isNewCategory: false }
    }
    return { direction: 'up', percent: null, isNewCategory: true }
  }

  const rawPercent = Math.round(((current - prior) / prior) * 100)

  if (rawPercent === 0) {
    return { direction: 'flat', percent: 0, isNewCategory: false }
  }

  return {
    direction: rawPercent > 0 ? 'up' : 'down',
    percent: Math.abs(rawPercent),
    isNewCategory: false,
  }
}

export function isSignificantCategoryDelta(delta) {
  if (!delta || delta.isNewCategory) {
    return false
  }

  if (delta.direction === 'flat') {
    return false
  }

  if (delta.percent == null) {
    return true
  }

  return delta.percent >= SIGNIFICANT_CATEGORY_CHANGE_PERCENT
}

function categoryChangeMagnitude({ spendingDelta }) {
  if (!spendingDelta || spendingDelta.isNewCategory) {
    return null
  }

  return Math.abs(spendingDelta.percent ?? 0)
}

function toPublicCategoryDelta(spendingDelta) {
  if (!spendingDelta || spendingDelta.isNewCategory) {
    return null
  }

  return {
    direction: spendingDelta.direction,
    percent: spendingDelta.percent,
  }
}

/**
 * Builds per-category MoM breakdown from an already-loaded comparison object.
 * Sorted by absolute percent change descending (categories without a comparable delta sort last).
 */
export function buildCategoryBreakdownFromComparison(comparison) {
  if (!comparison) {
    return []
  }

  const { currentPeriod, priorPeriod, hasComparisonData } = comparison
  const categories = new Set([
    ...Object.keys(currentPeriod?.spending?.byCategory ?? {}),
    ...Object.keys(priorPeriod?.spending?.byCategory ?? {}),
  ])

  return [...categories]
    .map((category) => {
      const currentTotal = currentPeriod.spending.byCategory[category] ?? 0
      const priorTotal = priorPeriod.spending.byCategory[category] ?? 0
      const spendingDelta = hasComparisonData
        ? computeSpendingDelta(currentTotal, priorTotal)
        : null

      return {
        category,
        currentTotal,
        priorTotal,
        spendingDelta,
      }
    })
    .sort((left, right) => {
      const leftMagnitude = categoryChangeMagnitude(left)
      const rightMagnitude = categoryChangeMagnitude(right)

      if (leftMagnitude !== rightMagnitude) {
        return (rightMagnitude ?? -1) - (leftMagnitude ?? -1)
      }

      return right.currentTotal - left.currentTotal
    })
}

/**
 * Single source of truth for category-level MoM deltas.
 * Used by insight generation and the Expense Analyzer page.
 */
export async function getCategoryBreakdownWithDeltas(userId) {
  const comparison = await loadMonthOverMonthComparison(userId)

  return buildCategoryBreakdownFromComparison(comparison).map(
    ({ category, currentTotal, priorTotal, spendingDelta }) => ({
      category,
      currentTotal,
      priorTotal,
      delta: toPublicCategoryDelta(spendingDelta),
    })
  )
}

export async function detectRecurringCharges(userId) {
  const { loadRecentTransactionsForRecurring, detectRecurringChargesFromTransactions } =
    await import('./expenseAnalyzerData.js')
  const rows = await loadRecentTransactionsForRecurring(userId)
  return detectRecurringChargesFromTransactions(rows)
}

/*
 * loadExpenseAnalyzerChatContext(userId)
 *
 * Re-exported from expenseAnalyzerChatContext for callers that already import here.
 */
export { loadExpenseAnalyzerChatContext } from './expenseAnalyzerChatContext.js'

export async function loadMonthOverMonthComparison(userId) {
  const [
    currentSpendingTotalResult,
    currentSpendingByCategoryResult,
    priorSpendingTotalResult,
    priorSpendingByCategoryResult,
    currentIncomeTotalResult,
    priorIncomeTotalResult,
    priorTransactionCountResult,
  ] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(t.category, 'Uncategorized') AS category,
              COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         AND t.date >= NOW() - $2::interval
       GROUP BY t.category`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $3::interval
         AND t.date < NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COALESCE(t.category, 'Uncategorized') AS category,
              COALESCE(SUM(t.amount), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount > 0
         AND t.date >= NOW() - $3::interval
         AND t.date < NOW() - $2::interval
       GROUP BY t.category`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount < 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND t.amount < 0
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $3::interval
         AND t.date < NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         ${NON_PENDING_FILTER}
         AND t.date >= NOW() - $3::interval
         AND t.date < NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
  ])

  const hasComparisonData = priorTransactionCountResult.rows[0].count > 0

  return {
    currentPeriod: {
      spending: {
        total: Number(currentSpendingTotalResult.rows[0].total),
        byCategory: buildCategoryTotals(currentSpendingByCategoryResult.rows),
      },
      income: {
        total: Number(currentIncomeTotalResult.rows[0].total),
      },
    },
    priorPeriod: {
      spending: {
        total: Number(priorSpendingTotalResult.rows[0].total),
        byCategory: buildCategoryTotals(priorSpendingByCategoryResult.rows),
      },
      income: {
        total: Number(priorIncomeTotalResult.rows[0].total),
      },
    },
    hasComparisonData,
  }
}

export async function loadFinancialContextForUser(userId) {
  /*
   * Insight generation must match chat / expense analyzer / dashboard:
   * only transactions still linked to a connected Plaid Item.
   * After disconnect, account_id is nulled — those rows stay in Postgres
   * but must not feed AI advice the rest of the app no longer shows.
   */
  const [transactionsResult, accountsResult] = await Promise.all([
    db.query(
      `SELECT t.*,
              a.bank_name,
              a.account_name
       FROM transactions t
       ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
       WHERE t.user_id = $1
         AND (t.pending IS NOT TRUE)
         AND t.date >= NOW() - $2::interval
       ORDER BY t.date DESC`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT account_name, account_type, balance_current, balance_available
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
  ])

  const accountSummary = accountsResult.rows
    .map(
      (a) =>
        `${a.account_name} (${a.account_type}): $${getDisplayBalance(a)}`
    )
    .join('\n')

  return {
    transactions: transactionsResult.rows,
    accountSummary,
  }
}
