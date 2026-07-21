/*
 * ROLLING COMPARISON (shared MoM / Expense Analyzer windows)
 *
 * What this does:
 * - Builds the same current/prior spending+income snapshot for insights and
 *   Expense Analyzer, using app-timezone civil days (not UTC NOW()-interval).
 * - Nets same-merchant refunds into spending so a $500 buy + $500 refund is $0
 *   spend, not $500 spend + $500 income.
 * - Gates hasComparisonData on deep enough history so a 40-day Plaid backfill
 *   cannot claim a full "vs prior 30 days" story.
 *
 * Policy — refunds:
 * Spending totals are net of same-merchant negatives in the same window.
 * Payroll, bank deposits, and peer-in stay income. Unmatched negatives (no
 * same-merchant spend in-window) also stay income.
 */

import {
  ROLLING_COMPARISON_DAYS,
  daysBetweenIsoDates,
  formatIsoDateInAppTz,
  getAppTodayIso,
  isWithinAppDaysAgo,
  isWithinAppPriorPeriod,
} from './calendarMonth.js'
import {
  CASH_FLOW_KINDS,
  classifyCashFlowTransaction,
  isCashFlowIncomeRow,
  isCashFlowSpendingRow,
  isDepositTransaction,
  isPayrollIncomeTransaction,
} from './cashFlowClassification.js'
import { normalizeMerchantName } from './merchantNormalize.js'
import { resolveSpendingCategoryLabel } from './plaidCategory.js'

/** Earliest connected txn must be at least this many days old. */
export const MIN_COMPARISON_HISTORY_DAYS = 55

/** Prior window needs at least this many spend/income rows (not self-transfers only). */
export const MIN_PRIOR_WINDOW_TXNS = 3

function toIsoDateInput(dateInput) {
  if (typeof dateInput === 'string') {
    return dateInput.slice(0, 10)
  }
  return formatIsoDateInAppTz(dateInput instanceof Date ? dateInput : new Date(dateInput))
}

function buildCategoryTotals(rows) {
  const byCategory = {}

  for (const row of rows) {
    const category = resolveSpendingCategoryLabel(row)
    byCategory[category] = (byCategory[category] ?? 0) + Number(row.amount)
  }

  return byCategory
}

function isProtectedIncome(row) {
  if (isPayrollIncomeTransaction(row) || isDepositTransaction(row)) {
    return true
  }
  const kind = classifyCashFlowTransaction(row)
  return kind === CASH_FLOW_KINDS.PEER_IN || kind === CASH_FLOW_KINDS.SELF_DEPOSIT
}

/**
 * Move same-merchant refunds from income into spending (as negative amounts).
 */
export function netSameMerchantRefunds(spendingRows, incomeRows) {
  const spendKeys = new Set(
    spendingRows.map((row) => normalizeMerchantName(row.name)).filter(Boolean)
  )
  const nettedRefunds = []
  const keptIncome = []

  for (const row of incomeRows) {
    const key = normalizeMerchantName(row.name)
    if (key && spendKeys.has(key) && !isProtectedIncome(row)) {
      nettedRefunds.push(row)
    } else {
      keptIncome.push(row)
    }
  }

  return {
    spendingRows: [...spendingRows, ...nettedRefunds],
    incomeRows: keptIncome,
  }
}

export function evaluateHasComparisonData(transactions, referenceDate = new Date()) {
  const todayIso = getAppTodayIso(referenceDate)
  let earliestIso = null

  for (const row of transactions) {
    const iso = toIsoDateInput(row.date)
    if (!earliestIso || iso < earliestIso) {
      earliestIso = iso
    }
  }

  if (!earliestIso) {
    return false
  }

  const historyDays = daysBetweenIsoDates(todayIso, earliestIso)
  if (historyDays < MIN_COMPARISON_HISTORY_DAYS) {
    return false
  }

  const priorMeaningful = transactions.filter((row) => {
    if (!isWithinAppPriorPeriod(row.date, ROLLING_COMPARISON_DAYS, ROLLING_COMPARISON_DAYS * 2, referenceDate)) {
      return false
    }
    return isCashFlowSpendingRow(row) || isCashFlowIncomeRow(row)
  })

  return priorMeaningful.length >= MIN_PRIOR_WINDOW_TXNS
}

function periodTotals(spendingRows, incomeRows) {
  const netted = netSameMerchantRefunds(spendingRows, incomeRows)
  return {
    spending: {
      total: netted.spendingRows.reduce((sum, row) => sum + Number(row.amount), 0),
      byCategory: buildCategoryTotals(netted.spendingRows),
    },
    income: {
      total: netted.incomeRows.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0),
    },
  }
}

/**
 * Shared current/prior comparison snapshot (insights + Expense Analyzer).
 */
export function buildComparisonFromTransactions(transactions, referenceDate = new Date()) {
  const currentSpendingRows = transactions.filter(
    (row) =>
      isCashFlowSpendingRow(row) &&
      isWithinAppDaysAgo(row.date, ROLLING_COMPARISON_DAYS, referenceDate)
  )
  const priorSpendingRows = transactions.filter(
    (row) =>
      isCashFlowSpendingRow(row) &&
      isWithinAppPriorPeriod(
        row.date,
        ROLLING_COMPARISON_DAYS,
        ROLLING_COMPARISON_DAYS * 2,
        referenceDate
      )
  )
  const currentIncomeRows = transactions.filter(
    (row) =>
      isCashFlowIncomeRow(row) &&
      isWithinAppDaysAgo(row.date, ROLLING_COMPARISON_DAYS, referenceDate)
  )
  const priorIncomeRows = transactions.filter(
    (row) =>
      isCashFlowIncomeRow(row) &&
      isWithinAppPriorPeriod(
        row.date,
        ROLLING_COMPARISON_DAYS,
        ROLLING_COMPARISON_DAYS * 2,
        referenceDate
      )
  )

  return {
    hasComparisonData: evaluateHasComparisonData(transactions, referenceDate),
    currentPeriod: periodTotals(currentSpendingRows, currentIncomeRows),
    priorPeriod: periodTotals(priorSpendingRows, priorIncomeRows),
  }
}
