/*
 * QUICK TOOLS HELPERS
 *
 * Pure functions for the dashboard Quick Tools section — aggregating
 * recent transactions, period comparison inputs, and account health signals.
 */

import { getDisplayBalance, isLiabilityAccount } from './balanceHelpers.js'
import { hoursSinceSync, SYNC_STALE_HOURS } from './dashboardAttention.js'

export const QUICK_TOOL_TABS = {
  RECENT: 'recent',
  HEALTH: 'health',
  TRACKER: 'tracker',
  FORECAST: 'forecast',
  SPEND: 'spend',
}

/** Bigger bets — surfaced until we ship them. */
export const COMING_SOON_TOOLS = [
  {
    id: 'alerts',
    title: 'Custom alerts',
    description: 'Get notified when spending crosses thresholds you define.',
  },
]

export function formatQuickToolDate(dateString) {
  if (!dateString) {
    return '—'
  }

  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelativeSync(lastSyncedAt) {
  if (!lastSyncedAt) {
    return 'Never synced'
  }

  const hours = hoursSinceSync(lastSyncedAt)

  if (hours < 1) {
    return 'Synced recently'
  }

  if (hours < 24) {
    const rounded = Math.floor(hours)
    return `Synced ${rounded} hour${rounded === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(hours / 24)
  return `Synced ${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * Flattens per-category recentTransactions into one list, newest first.
 * Prefers recentCashFlowActivity when present (includes Zelle/income inflows).
 */
export function collectRecentTransactions(categoryBreakdown, limit = 8, recentCashFlowActivity = null) {
  if (Array.isArray(recentCashFlowActivity) && recentCashFlowActivity.length > 0) {
    return recentCashFlowActivity.slice(0, limit)
  }

  const combined = []

  for (const entry of categoryBreakdown ?? []) {
    const categoryLabel = entry.displayCategory ?? entry.category

    for (const transaction of entry.recentTransactions ?? []) {
      combined.push({
        ...transaction,
        category: categoryLabel,
        direction: 'out',
      })
    }
  }

  return combined
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, limit)
}

/**
 * Summarizes sync freshness and per-account balance warnings.
 */
export function assessAccountHealth(accounts, lastSyncedAt) {
  const syncStale = hoursSinceSync(lastSyncedAt) >= SYNC_STALE_HOURS

  const accountStatuses = (accounts ?? []).map((account) => {
    const balance = getDisplayBalance(account)
    const liability = isLiabilityAccount(account)
    const warning = liability ? balance > 0 : balance < 0

    return {
      account,
      balance,
      credit: liability,
      status: warning ? 'warning' : 'healthy',
      message: warning
        ? liability
          ? 'Balance owed'
          : 'Low or negative balance'
        : 'Looks good',
    }
  })

  const warningCount = accountStatuses.filter((row) => row.status === 'warning').length

  return {
    syncStale,
    lastSyncedAt,
    accountStatuses,
    warningCount,
    needsAttention: syncStale || warningCount > 0,
  }
}
