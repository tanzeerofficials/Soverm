/*
 * BUDGET SNAPSHOT SERVICE
 *
 * Loads accounts, calendar-month spend, and user budget — then computes
 * safe-to-spend for the dashboard and budget API.
 */

import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { loadMonthlyBudget } from '../utils/budgetPreferences.js'
import { listActiveSavingsGoals } from './savingsGoalsService.js'
import { sumPlannedGoalsMonthly } from '../utils/savingsGoals.js'
import {
  computeSafeToSpend,
  getCalendarMonthWindow,
  roundCurrency,
} from '../utils/safeToSpend.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

export async function loadSuggestedBudget(userId) {
  const result = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       AND t.date >= NOW() - INTERVAL '30 days'`,
    [userId]
  )

  return roundCurrency(result.rows[0].total)
}

export async function loadSpentThisCalendarMonth(userId) {
  const result = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       AND t.date >= date_trunc('month', CURRENT_DATE)::date
       AND t.date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`,
    [userId]
  )

  return roundCurrency(result.rows[0].total)
}

export async function buildBudgetSnapshot(userId) {
  const [accountsResult, lastSyncedResult, monthlyBudget, spentThisMonth, suggestedBudget, goals] =
    await Promise.all([
      db.query(
        `SELECT id, bank_name, account_name, account_type,
                balance_current, balance_available, currency
         FROM accounts
         WHERE user_id = $1`,
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
      loadMonthlyBudget(userId),
      loadSpentThisCalendarMonth(userId),
      loadSuggestedBudget(userId),
      listActiveSavingsGoals(userId),
    ])

  const accounts = accountsResult.rows.map((account) => ({
    ...account,
    displayBalance: getDisplayBalance(account),
  }))
  const netBalance = calculateTotalBalance(accounts)
  const period = getCalendarMonthWindow()
  const plannedGoalsThisMonth = sumPlannedGoalsMonthly(goals)
  const metrics = computeSafeToSpend({
    monthlyBudget,
    spentThisMonth,
    netBalance,
    plannedGoalsThisMonth,
  })

  return {
    ...metrics,
    goals,
    suggestedBudget,
    ...period,
    accountCount: accounts.length,
    lastSyncedAt: lastSyncedResult.rows[0]?.last_synced ?? null,
  }
}
