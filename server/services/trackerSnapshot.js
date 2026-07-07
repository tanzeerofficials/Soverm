/*
 * TRACKER SNAPSHOT SERVICE
 *
 * Builds calendar-month progress for spending caps and savings goals.
 */

import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { listActiveTrackers } from './monthlyTrackersService.js'
import {
  enrichTracker,
} from '../utils/monthlyTrackers.js'
import {
  getCalendarMonthWindow,
  roundCurrency,
} from '../utils/safeToSpend.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

async function loadIncomeThisCalendarMonth(userId) {
  const result = await db.query(
    `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount < 0
       ${NON_PENDING_FILTER}
       AND t.date >= date_trunc('month', CURRENT_DATE)::date
       AND t.date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`,
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
  const [accountsResult, lastSyncedResult, spentThisMonth, incomeThisMonth, suggestedSpendingLimit, trackers] =
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
      loadSpentThisCalendarMonth(userId),
      loadIncomeThisCalendarMonth(userId),
      loadSuggestedSpendingLimit(userId),
      listActiveTrackers(userId),
    ])

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
    ...period,
    accountCount: accounts.length,
    lastSyncedAt: lastSyncedResult.rows[0]?.last_synced ?? null,
  }
}

async function monthlyTrackersTableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'`
  )

  return result.rows.length > 0
}

function mapLegacyGoalToTracker(goal) {
  return {
    id: goal.id,
    trackType: 'saving',
    name: goal.name,
    purposeType: goal.purposeType,
    monthlyAmount: goal.monthlyAmount,
    targetTotal: goal.targetTotal,
    progressAmount: goal.savedSoFar ?? 0,
    active: goal.active !== false,
  }
}

/**
 * Converts pre-013 budget/goals snapshot into the unified tracker shape
 * so the client always receives a consistent API response.
 */
export function normalizeLegacyBudgetSnapshot(legacy) {
  const spentThisMonth = legacy.spentThisMonth ?? 0
  const incomeThisMonth = legacy.incomeThisMonth ?? 0
  const trackers = []

  let spendingTracker = null
  if (legacy.configured && legacy.monthlyBudget) {
    spendingTracker = enrichTracker(
      {
        id: 'legacy-spending',
        trackType: 'spending',
        name: 'Monthly spending',
        purposeType: null,
        monthlyAmount: legacy.monthlyBudget,
        targetTotal: null,
        progressAmount: 0,
        active: true,
      },
      { spentThisMonth, income: incomeThisMonth }
    )
    trackers.push(spendingTracker)
  }

  const savingTrackers = (legacy.goals ?? []).map((goal) => {
    const enriched = enrichTracker(mapLegacyGoalToTracker(goal), {
      spentThisMonth,
      income: incomeThisMonth,
    })
    trackers.push(enriched)
    return enriched
  })

  const spendingProgress = spendingTracker?.progress ?? null

  return {
    ...legacy,
    trackers,
    spendingTracker,
    savingTrackers,
    incomeThisMonth,
    suggestedSpendingLimit: legacy.suggestedBudget ?? null,
    isOverBudget: legacy.isOverBudget ?? spendingProgress?.isOver ?? false,
    overBudgetBy: legacy.overBudgetBy ?? spendingProgress?.overBy ?? null,
    percentUsed: legacy.percentUsed ?? spendingProgress?.percentUsed ?? null,
    remainingBudget: legacy.remainingBudget ?? spendingProgress?.remaining ?? null,
  }
}

export async function buildTrackerSnapshotWithFallback(userId) {
  if (await monthlyTrackersTableExists()) {
    return buildTrackerSnapshot(userId)
  }

  const { buildBudgetSnapshot } = await import('./budgetSnapshot.js')
  const legacy = await buildBudgetSnapshot(userId)
  return normalizeLegacyBudgetSnapshot(legacy)
}
