import db from '../db/index.js'
import { getDisplayBalance } from './balanceHelpers.js'

// Shared rolling window for insight transaction context and month-over-month comparison.
export const COMPARISON_PERIOD_INTERVAL = '30 days'

function buildCategoryTotals(rows) {
  const byCategory = {}

  for (const row of rows) {
    const category = row.category || 'Uncategorized'
    byCategory[category] = Number(row.total)
  }

  return byCategory
}

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
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount > 0
         AND date >= NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(category, 'Uncategorized') AS category,
              COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount > 0
         AND date >= NOW() - $2::interval
       GROUP BY category`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount > 0
         AND date >= NOW() - $3::interval
         AND date < NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COALESCE(category, 'Uncategorized') AS category,
              COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount > 0
         AND date >= NOW() - $3::interval
         AND date < NOW() - $2::interval
       GROUP BY category`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COALESCE(SUM(ABS(amount)), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount < 0
         AND date >= NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL]
    ),
    db.query(
      `SELECT COALESCE(SUM(ABS(amount)), 0) AS total
       FROM transactions
       WHERE user_id = $1
         AND amount < 0
         AND date >= NOW() - $3::interval
         AND date < NOW() - $2::interval`,
      [userId, COMPARISON_PERIOD_INTERVAL, '60 days']
    ),
    db.query(
      `SELECT COUNT(*)::int AS count
       FROM transactions
       WHERE user_id = $1
         AND date >= NOW() - $3::interval
         AND date < NOW() - $2::interval`,
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
  const [transactionsResult, accountsResult] = await Promise.all([
    db.query(
      `SELECT t.*,
              a.bank_name,
              COALESCE(a.account_name, 'Disconnected account') AS account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = $1
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
