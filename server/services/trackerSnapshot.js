/*
 * TRACKER SNAPSHOT SERVICE
 *
 * Builds calendar-month progress for spending caps and savings goals.
 */

import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { hasMonthlyTrackersTable } from '../utils/monthlyTrackersSchema.js'
import { listActiveTrackers } from './monthlyTrackersService.js'
import {
  listPendingSavingsTransferDetections,
  scanAndStoreSavingsTransferDetections,
} from './savingsTransferDetection.js'
import {
  enrichTracker,
} from '../utils/monthlyTrackers.js'
import {
  getCalendarMonthWindow,
  roundCurrency,
} from '../utils/safeToSpend.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'
const CALENDAR_MONTH_FILTER = `AND t.date >= date_trunc('month', CURRENT_DATE)::date
       AND t.date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`

export async function loadCalendarMonthCashFlow(userId) {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spent,
       COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS income
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       ${CALENDAR_MONTH_FILTER}`,
    [userId]
  )

  return {
    spentThisMonth: roundCurrency(result.rows[0].spent),
    incomeThisMonth: roundCurrency(result.rows[0].income),
  }
}

export async function loadSpentThisCalendarMonth(userId) {
  const { spentThisMonth } = await loadCalendarMonthCashFlow(userId)
  return spentThisMonth
}

export async function loadSuggestedSpendingLimit(userId) {
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

export async function buildTrackerSnapshot(userId) {
  const [accountsResult, lastSyncedResult, cashFlow, trackers] = await Promise.all([
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
      loadCalendarMonthCashFlow(userId),
      listActiveTrackers(userId),
    ])

  const { spentThisMonth, incomeThisMonth } = cashFlow
  const hasSpendingTracker = trackers.some((tracker) => tracker.trackType === 'spending')
  const suggestedSpendingLimit = hasSpendingTracker
    ? 0
    : await loadSuggestedSpendingLimit(userId)

  const accounts = accountsResult.rows.map((account) => ({
    ...account,
    displayBalance: getDisplayBalance(account),
  }))
  const netBalance = calculateTotalBalance(accounts)
  const period = getCalendarMonthWindow()

  const enrichedTrackers = trackers.map((tracker) =>
    enrichTracker(tracker, { spentThisMonth, income: incomeThisMonth })
  )

  const spendingTracker = enrichedTrackers.find((tracker) => tracker.trackType === 'spending') ?? null
  const savingTrackers = enrichedTrackers.filter((tracker) => tracker.trackType === 'saving')

  let spendingSummary = null
  if (spendingTracker) {
    const progress = spendingTracker.progress
    spendingSummary = {
      ...progress,
      monthlyLimit: spendingTracker.monthlyAmount,
      safeToSpend: roundCurrency(Math.min(netBalance, Math.max(0, progress.remaining))),
    }
  }

  // Legacy hero fields when a spending tracker exists
  const configured = spendingTracker != null
  const monthlyBudget = spendingTracker?.monthlyAmount ?? null
  const safeToSpend = spendingSummary?.safeToSpend ?? null
  const spendingProgress = spendingTracker?.progress

  const savingsDetectionResult = await scanAndStoreSavingsTransferDetections(userId)
  const pendingSavingsDetections = await listPendingSavingsTransferDetections(userId)

  return {
    trackers: enrichedTrackers,
    spendingTracker,
    savingTrackers,
    spendingSummary,
    configured,
    monthlyBudget,
    spentThisMonth,
    incomeThisMonth,
    safeToSpend,
    remainingBudget: spendingProgress?.remaining ?? null,
    overBudgetBy: spendingProgress?.overBy ?? null,
    percentUsed: spendingProgress?.percentUsed ?? null,
    isOverBudget: spendingProgress?.isOver ?? false,
    netBalance,
    suggestedSpendingLimit,
    suggestedBudget: suggestedSpendingLimit,
    pendingSavingsDetections,
    savingsDetectionsScanned: savingsDetectionResult.created ?? 0,
    ...period,
    accountCount: accounts.length,
    lastSyncedAt: lastSyncedResult.rows[0]?.last_synced ?? null,
  }
}

export async function buildTrackerSnapshotWithFallback(userId) {
  if (!(await hasMonthlyTrackersTable())) {
    const error = new Error('Monthly trackers are not available yet — run migration 013')
    error.statusCode = 503
    throw error
  }

  return buildTrackerSnapshot(userId)
}
