/*
 * CASH FLOW FORECAST SERVICE
 *
 * Loads live account balances, recent cash flow, and confirmed recurring
 * charges, then returns a 30-day projection for the dashboard.
 *
 * Income/spend baselines exclude transfers and credit-card/loan payments so
 * internal moves do not inflate both income and spending.
 */

import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import {
  buildCashFlowForecast,
  FORECAST_HORIZON_DAYS,
  summarizeForecastRisk,
} from '../utils/cashFlowForecast.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
} from '../utils/transactionFilters.js'

function sumRecurringMonthly(recurringCharges = []) {
  return roundCurrency(
    recurringCharges.reduce((sum, charge) => sum + (charge.monthlyEquivalent ?? 0), 0)
  )
}

async function loadForecastBaselines(userId) {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spending,
       COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS income
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND t.date >= NOW() - INTERVAL '30 days'`,
    [userId]
  )

  return {
    spendingLast30Days: roundCurrency(result.rows[0].spending),
    incomeLast30Days: roundCurrency(result.rows[0].income),
  }
}

export async function buildCashFlowForecastForUser(userId, { referenceDate = new Date() } = {}) {
  const [accountsResult, baselines, expensePayload] = await Promise.all([
    db.query(
      `SELECT id, bank_name, account_name, account_type,
              balance_current, balance_available, currency
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
    loadForecastBaselines(userId),
    loadExpenseAnalyzerData(userId),
  ])

  const accounts = accountsResult.rows.map((account) => ({
    ...account,
    displayBalance: getDisplayBalance(account),
  }))
  const startingBalance = calculateTotalBalance(accounts)
  const recurringCharges = expensePayload.recurringCharges ?? []
  const confirmedRecurringMonthly =
    expensePayload.totalRecurringMonthly ?? sumRecurringMonthly(recurringCharges)

  const forecast = buildCashFlowForecast({
    startingBalance,
    incomeLast30Days: baselines.incomeLast30Days,
    spendingLast30Days: baselines.spendingLast30Days,
    confirmedRecurringMonthly,
    recurringCharges,
    horizonDays: FORECAST_HORIZON_DAYS,
    referenceDate,
  })

  return {
    ...forecast,
    accountCount: accounts.length,
    recurringChargeCount: recurringCharges.length,
    risk: summarizeForecastRisk(forecast),
  }
}
