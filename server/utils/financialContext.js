import db from '../db/index.js'
import { getDisplayBalance } from './balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from './connectedAccountTransactions.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
} from './transactionFilters.js'

export { normalizeMerchantName } from './merchantNormalize.js'

// Shared rolling window for insight transaction context and month-over-month comparison.
export const COMPARISON_PERIOD_INTERVAL = '30 days'
export const RECURRING_CHARGE_LOOKBACK_INTERVAL = '3 months'

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

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100
}

function roundTimes(times) {
  if (!Number.isFinite(times)) {
    return null
  }

  return Math.round(times * 100) / 100
}

/**
 * Formats a multiplier for people, not spreadsheets.
 * 8.87 → "8.9×", 1.5 → "1.5×", 12.3 → "12×"
 */
export function formatTimesMultiplier(times) {
  const value = roundTimes(times)
  if (value == null || value <= 0) {
    return null
  }

  if (value >= 10) {
    return `${Math.round(value)}×`
  }

  const oneDecimal = Math.round(value * 10) / 10
  return Number.isInteger(oneDecimal) ? `${oneDecimal}×` : `${oneDecimal.toFixed(1)}×`
}

export function formatMoneyAmount(amount) {
  return `$${roundMoney(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Computes month-over-month direction plus percent, times, and dollar change.
 * Prefer times + absoluteChange in user-facing copy; percent stays for significance thresholds.
 */
export function computeSpendingDelta(current, prior) {
  const currentTotal = roundMoney(current)
  const priorTotal = roundMoney(prior)

  if (priorTotal === 0) {
    if (currentTotal === 0) {
      return {
        direction: 'flat',
        percent: 0,
        times: null,
        absoluteChange: 0,
        isNewCategory: false,
      }
    }
    return {
      direction: 'up',
      percent: null,
      times: null,
      absoluteChange: currentTotal,
      isNewCategory: true,
    }
  }

  const rawPercent = Math.round(((currentTotal - priorTotal) / priorTotal) * 100)
  const times = roundTimes(currentTotal / priorTotal)
  const absoluteChange = roundMoney(Math.abs(currentTotal - priorTotal))

  if (rawPercent === 0) {
    return {
      direction: 'flat',
      percent: 0,
      times: 1,
      absoluteChange: 0,
      isNewCategory: false,
    }
  }

  return {
    direction: rawPercent > 0 ? 'up' : 'down',
    percent: Math.abs(rawPercent),
    times,
    absoluteChange,
    isNewCategory: false,
  }
}

/**
 * Human comparison line for prompts and narrative.
 * Prefer calm dollar context: "$842 this period (was $712 before)" — not "1.2×" scare framing.
 */
export function formatComparisonPhrase(current, prior, delta, { vsLabel = 'vs prior 30 days' } = {}) {
  const currentTotal = roundMoney(current)
  const priorTotal = roundMoney(prior)

  if (!delta || delta.direction === 'flat') {
    return `about even ${vsLabel} (${formatMoneyAmount(currentTotal)} vs ${formatMoneyAmount(priorTotal)})`
  }

  if (delta.isNewCategory) {
    return `new this period (${formatMoneyAmount(currentTotal)} now, $0 in the prior period)`
  }

  const signedChange =
    delta.direction === 'up'
      ? `+${formatMoneyAmount(delta.absoluteChange ?? Math.abs(currentTotal - priorTotal))}`
      : `−${formatMoneyAmount(delta.absoluteChange ?? Math.abs(currentTotal - priorTotal))}`

  return `${formatMoneyAmount(currentTotal)} this period (was ${formatMoneyAmount(priorTotal)} before, ${signedChange})`
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
    times: spendingDelta.times ?? null,
    absoluteChange: spendingDelta.absoluteChange ?? null,
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
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${NON_PENDING_FILTER}
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${NON_PENDING_FILTER}
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
         ${EXCLUDE_INTERNAL_MOVES_FILTER}
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
