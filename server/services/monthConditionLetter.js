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
  NON_PENDING_FILTER,
  summarizeCashFlow,
} from '../utils/transactionFilters.js'
import {
  classifyCashFlowTransaction,
  MONEY_OUT_KINDS,
} from '../utils/cashFlowClassification.js'
import { resolveSpendingCategoryLabel } from '../utils/plaidCategory.js'
import { EXPENSE_ANALYZER_TRANSACTION_SELECT } from '../utils/connectedAccountTransactions.js'

async function loadMonthCashFlow(userId, startIso, endExclusiveIso) {
  const result = await db.query(
    `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date
     ORDER BY t.date DESC`,
    [userId, startIso, endExclusiveIso]
  )

  const summary = summarizeCashFlow(result.rows, { activityLimit: 40 })

  return {
    income: summary.moneyIn,
    spent: summary.moneyOut,
    moneyIn: summary.moneyIn,
    moneyOut: summary.moneyOut,
    net: summary.net,
    byKind: summary.byKind,
    selfTransfers: summary.selfTransfers,
    internalMoved: summary.internalMoved,
    liabilityPayments: summary.liabilityPayments,
    activity: summary.activity,
  }
}

async function loadTopCategories(userId, startIso, endExclusiveIso, limit = 3) {
  const result = await db.query(
    `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date`,
    [userId, startIso, endExclusiveIso]
  )

  const byCategory = new Map()
  for (const row of result.rows) {
    const kind = classifyCashFlowTransaction(row)
    if (!MONEY_OUT_KINDS.has(kind)) {
      continue
    }
    const category = resolveSpendingCategoryLabel(row)
    byCategory.set(category, (byCategory.get(category) ?? 0) + Math.abs(Number(row.amount) || 0))
  }

  const allRows = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount: roundCurrency(amount) }))
    .sort((left, right) => right.amount - left.amount)

  // Percent is share of ALL external spending this month — not of the top-N slice.
  // Otherwise a top driver at $100 of $1000 spend can show as "100%" and confuse users.
  const totalSpend = allRows.reduce((sum, row) => sum + row.amount, 0)
  return allRows.slice(0, limit).map((row) => ({
    ...row,
    percentOfTotal:
      totalSpend > 0 ? Math.round((row.amount / totalSpend) * 1000) / 10 : null,
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
    byKind: cashFlow.byKind,
    selfTransfers: cashFlow.selfTransfers,
    internalMoved: cashFlow.internalMoved,
    liabilityPayments: cashFlow.liabilityPayments,
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
