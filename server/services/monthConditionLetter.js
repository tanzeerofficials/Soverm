/*
 * MONTH CONDITION LETTER SERVICE
 *
 * Builds the accountant-style monthly condition report for a user.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import {
  formatMonthKey,
  getAppTodayIso,
  getCalendarMonthWindow,
  getCalendarMonthWindowForMonthKey,
  getPriorMonthKey,
  getZonedDateParts,
} from '../utils/calendarMonth.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import { buildMonthConditionLetter } from '../utils/monthConditionLetter.js'
import {
  buildBillDefenseFindings,
  buildCancelKeepWatchPrompt,
} from '../utils/billDefense.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import { buildTrackerSnapshotWithFallback } from './trackerSnapshot.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
} from '../utils/transactionFilters.js'

async function loadMonthCashFlow(userId, startIso, endExclusiveIso) {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spent,
       COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS income
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date`,
    [userId, startIso, endExclusiveIso]
  )

  return {
    spent: roundCurrency(result.rows[0].spent),
    income: roundCurrency(result.rows[0].income),
  }
}

async function loadTopCategories(userId, startIso, endExclusiveIso, limit = 3) {
  const result = await db.query(
    `SELECT COALESCE(t.category, 'Uncategorized') AS category,
            COALESCE(SUM(t.amount), 0) AS amount
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date
     GROUP BY 1
     ORDER BY amount DESC
     LIMIT $4`,
    [userId, startIso, endExclusiveIso, limit]
  )

  const rows = result.rows.map((row) => ({
    category: row.category,
    amount: roundCurrency(row.amount),
  }))
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return rows.map((row) => ({
    ...row,
    percentOfTotal: total > 0 ? Math.round((row.amount / total) * 1000) / 10 : null,
  }))
}

function longMonthLabel(periodStartIso) {
  const [year, month] = periodStartIso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

/**
 * List recent month keys the user can open (current + up to 5 prior).
 */
export function listRecentMonthKeys(referenceDate = new Date(), count = 6) {
  const current = getCalendarMonthWindow(referenceDate)
  const keys = [formatMonthKey(current.periodStart)]
  let cursor = formatMonthKey(current.periodStart)
  for (let i = 1; i < count; i += 1) {
    cursor = getPriorMonthKey(`${cursor}-01`)
    keys.push(cursor)
  }
  return keys
}

export async function buildMonthConditionLetterForUser(
  userId,
  { monthKey = null, referenceDate = new Date() } = {}
) {
  const currentWindow = getCalendarMonthWindow(referenceDate)
  const currentKey = formatMonthKey(currentWindow.periodStart)
  const resolvedKey = monthKey ? String(monthKey).slice(0, 7) : currentKey
  const window = getCalendarMonthWindowForMonthKey(resolvedKey)
  const priorKey = getPriorMonthKey(window.periodStart)
  const priorWindow = getCalendarMonthWindowForMonthKey(priorKey)

  const todayIso = getAppTodayIso(referenceDate)
  const isCurrentMonth = resolvedKey === currentKey
  const isComplete = !isCurrentMonth || todayIso >= window.periodEnd

  const [cashFlow, priorCashFlow, topCategories, accountsResult, expensePayload, snapshot] =
    await Promise.all([
      loadMonthCashFlow(userId, window.periodStart, window.endExclusiveIso),
      loadMonthCashFlow(userId, priorWindow.periodStart, priorWindow.endExclusiveIso),
      loadTopCategories(userId, window.periodStart, window.endExclusiveIso),
      db.query(
        `SELECT id, bank_name, account_name, account_type,
                balance_current, balance_available, currency
         FROM accounts
         WHERE user_id = $1`,
        [userId]
      ),
      loadExpenseAnalyzerData(userId).catch(() => ({
        totalRecurringMonthly: 0,
        recurringCharges: [],
      })),
      buildTrackerSnapshotWithFallback(userId).catch(() => ({
        whatsLeftUntilPayday: { configured: false },
      })),
    ])

  const accounts = accountsResult.rows.map((account) => ({
    ...account,
    displayBalance: getDisplayBalance(account),
  }))
  const netBalance = calculateTotalBalance(accounts)
  const dayOfMonth = isCurrentMonth
    ? getZonedDateParts(referenceDate).day
    : Number(window.periodEnd.slice(8, 10))

  const letter = buildMonthConditionLetter({
    monthKey: resolvedKey,
    monthLabel: longMonthLabel(window.periodStart),
    periodLabel: isCurrentMonth ? currentWindow.periodLabel : `${window.monthLabel} 1–${window.periodEnd.slice(8)}`,
    isCurrentMonth,
    isComplete,
    income: cashFlow.income,
    spent: cashFlow.spent,
    netBalance,
    topCategories,
    recurringMonthly: expensePayload.totalRecurringMonthly ?? 0,
    priorIncome: priorCashFlow.income,
    priorSpent: priorCashFlow.spent,
    dayOfMonth,
    whatsLeftAmount: snapshot.whatsLeftUntilPayday?.amount ?? null,
  })

  const billDefense = buildBillDefenseFindings({
    recurringCharges: expensePayload.recurringCharges ?? [],
    reviewCharges: expensePayload.reviewCharges ?? [],
    todayIso,
    limit: 4,
  }).map((finding) => ({
    type: finding.type,
    tone: finding.tone,
    confidence: finding.confidence,
    title: finding.title,
    detail: finding.detail,
    merchant: finding.merchant,
    otherMerchant: finding.otherMerchant ?? null,
    monthlyEquivalent: finding.monthlyEquivalent,
    reviewPrompt: buildCancelKeepWatchPrompt(finding),
  }))

  return {
    ...letter,
    billDefense,
    availableMonths: listRecentMonthKeys(referenceDate).map((key) => ({
      monthKey: key,
      label: longMonthLabel(`${key}-01`),
      isCurrent: key === currentKey,
    })),
    accountCount: accounts.length,
  }
}
