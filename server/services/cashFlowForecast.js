/*
 * CASH FLOW FORECAST SERVICE
 *
 * Loads live account balances, recent cash flow, and confirmed recurring
 * charges, then returns a 30-day projection for the dashboard.
 */

import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { loadMonthOverMonthComparison } from '../utils/financialContext.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import {
  buildCashFlowForecast,
  FORECAST_HORIZON_DAYS,
  summarizeForecastRisk,
} from '../utils/cashFlowForecast.js'
import { roundCurrency } from '../utils/safeToSpend.js'

function sumRecurringMonthly(recurringCharges = []) {
  return roundCurrency(
    recurringCharges.reduce((sum, charge) => sum + (charge.monthlyEquivalent ?? 0), 0)
  )
}

export async function buildCashFlowForecastForUser(userId, { referenceDate = new Date() } = {}) {
  const [accountsResult, monthOverMonth, expensePayload] = await Promise.all([
    db.query(
      `SELECT id, bank_name, account_name, account_type,
              balance_current, balance_available, currency
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
    loadMonthOverMonthComparison(userId),
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

  const incomeLast30Days = monthOverMonth.currentPeriod?.income?.total ?? 0
  const spendingLast30Days = monthOverMonth.currentPeriod?.spending?.total ?? 0

  const forecast = buildCashFlowForecast({
    startingBalance,
    incomeLast30Days,
    spendingLast30Days,
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
