/*
 * Dashboard "needs attention" rules — pure helpers to decide what to surface
 * on the Overview tab (notifications, stale sync, pending actions, etc.).
 */

import {
  notificationActionLabel,
} from './notificationNavigation.js'
import { QUICK_TOOL_TABS } from './quickTools.js'
import {
  DEFAULT_SPENDING_CAP_WARNING_PERCENT,
  isSpendingCapWarningActive,
  resolveSpendingAlertThresholds,
} from './spendingAlertThresholds.js'

export const INSIGHT_STALE_DAYS = 5
export const SYNC_STALE_HOURS = 24
export const MAX_NOTIFICATION_ITEMS = 2
/** @deprecated Prefer resolveSpendingAlertThresholds / isSpendingCapWarningActive */
export const SPENDING_CAP_WARNING_PERCENT = DEFAULT_SPENDING_CAP_WARNING_PERCENT

function formatAttentionCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0)
}

/**
 * Surfaces spending-cap warnings for the Overview "Needs attention" card.
 * Uses tracker snapshot fields already loaded for the dashboard hero.
 */
export function buildTrackerAttentionItems(trackerSnapshot) {
  const spendingTracker = trackerSnapshot?.spendingTracker
  const progress = spendingTracker?.progress

  if (!progress) {
    return []
  }

  const periodLabel = trackerSnapshot?.periodLabel ?? 'this month'
  const capName = spendingTracker.name || 'Spending cap'
  const limit = spendingTracker.monthlyAmount ?? trackerSnapshot?.monthlyBudget
  const navigation = {
    tab: 'tools',
    quickToolTab: QUICK_TOOL_TABS.TRACKER,
    scrollTo: 'dashboard-quick-tools',
  }

  if (progress.isOver) {
    return [
      {
        id: 'spending-cap-over',
        tone: 'danger',
        title: `${capName} exceeded`,
        detail: `${formatAttentionCurrency(progress.spent)} of ${formatAttentionCurrency(limit)} spent ${periodLabel} — over by ${formatAttentionCurrency(progress.overBy)}.`,
        actionLabel: 'View tracker',
        ...navigation,
      },
    ]
  }

  if (isSpendingCapWarningActive(spendingTracker, progress)) {
    const thresholds = resolveSpendingAlertThresholds(spendingTracker)
    const thresholdHint = [
      thresholds.warningPercent != null ? `${thresholds.warningPercent}% used` : null,
      thresholds.remainingDollars != null
        ? `${formatAttentionCurrency(thresholds.remainingDollars)} left`
        : null,
    ]
      .filter(Boolean)
      .join(' or ')

    return [
      {
        id: 'spending-cap-warning',
        tone: 'warning',
        title: `Approaching ${capName.toLowerCase()}`,
        detail: `${formatAttentionCurrency(progress.spent)} of ${formatAttentionCurrency(limit)} spent ${periodLabel} (${progress.percentUsed}% used · ${formatAttentionCurrency(progress.remaining)} left${thresholdHint ? ` · alert at ${thresholdHint}` : ''}).`,
        actionLabel: 'View tracker',
        ...navigation,
      },
    ]
  }

  return []
}

/**
 * Surfaces detected savings transfers awaiting user confirmation.
 */
export function buildSavingsDetectionAttentionItems(trackerSnapshot) {
  const detections = trackerSnapshot?.pendingSavingsDetections ?? []
  const savingTrackers = trackerSnapshot?.savingTrackers ?? []

  if (detections.length === 0 || savingTrackers.length === 0) {
    return []
  }

  const trackerNameById = new Map(savingTrackers.map((tracker) => [tracker.id, tracker.name]))

  return detections.slice(0, 2).map((detection) => {
    const suggestedName = trackerNameById.get(detection.trackerId) ?? 'your savings goal'

    return {
      id: `savings-detection-${detection.id}`,
      detectionId: detection.id,
      tone: 'brand',
      title: 'Possible savings deposit',
      detail: `${formatAttentionCurrency(detection.amount)} on ${detection.transactionDate} (${detection.merchantName}) — add to ${suggestedName}?`,
      actionLabel: 'Review in tracker',
      tab: 'tools',
      quickToolTab: QUICK_TOOL_TABS.TRACKER,
      scrollTo: 'dashboard-quick-tools',
    }
  })
}

/**
 * Surfaces category soft-limit warnings / overages.
 */
export function buildCategoryLimitAttentionItems(trackerSnapshot) {
  const limits = trackerSnapshot?.categorySoftLimits ?? []

  return limits
    .filter((limit) => limit.isOver || limit.isWarning)
    .slice(0, 2)
    .map((limit) => ({
      id: `category-limit-${limit.id}`,
      tone: limit.isOver ? 'danger' : 'warning',
      title: limit.isOver
        ? `${limit.category} over limit`
        : `${limit.category} approaching limit`,
      detail: `${formatAttentionCurrency(limit.spentThisMonth)} of ${formatAttentionCurrency(limit.monthlyLimit)} this month (${limit.percentUsed}%).`,
      actionLabel: 'Open categories',
      tab: 'overview',
      href: '/expense-analyzer?tab=categories',
    }))
}

export function daysSince(isoDate) {
  if (!isoDate) {
    return Infinity
  }

  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
}

export function hoursSinceSync(lastSyncedAt) {
  if (!lastSyncedAt) {
    return Infinity
  }

  return (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60)
}

export function countIncompleteActions(actions) {
  return (actions ?? []).filter((action) => !action.completed).length
}

export function summarizeInsightActions(actions) {
  const normalized = actions ?? []
  const total = normalized.length
  const completed = normalized.filter((action) => action.completed).length

  return {
    total,
    completed,
    incomplete: total - completed,
    incompleteItems: normalized.filter((action) => !action.completed),
  }
}

export function getInsightFreshnessNudge(insightCreatedAt, { hasInsight = true } = {}) {
  if (!hasInsight || !insightCreatedAt) {
    return null
  }

  const dayCount = Math.floor(daysSince(insightCreatedAt))

  if (dayCount < INSIGHT_STALE_DAYS) {
    return null
  }

  return { dayCount }
}

/**
 * Builds ordered attention items for the Overview card.
 * Each item includes UI metadata (tone, labels) and navigation hints.
 */
export function buildAttentionItems({
  hasAccounts,
  hasInsight: _hasInsight,
  highlightGenerate,
  lastSyncedAt,
  incompleteActionCount,
  unreadNotifications = [],
  proactiveEnabled = true,
  trackerSnapshot = null,
}) {
  const items = []

  if (proactiveEnabled !== false) {
    for (const notification of unreadNotifications.slice(0, MAX_NOTIFICATION_ITEMS)) {
      items.push({
        id: `notification-${notification.id}`,
        tone: 'ai',
        title: notification.title,
        detail: notification.body,
        actionLabel: notificationActionLabel(notification),
        notificationId: notification.id,
        notification,
      })
    }
  }

  if (hasAccounts) {
    items.push(...buildTrackerAttentionItems(trackerSnapshot))
    items.push(...buildSavingsDetectionAttentionItems(trackerSnapshot))
    items.push(...buildCategoryLimitAttentionItems(trackerSnapshot))
  }

  if (!hasAccounts) {
    items.push({
      id: 'connect-bank',
      tone: 'brand',
      title: 'Connect your bank',
      detail: 'Link an account so Soverm can analyze your finances.',
      actionLabel: 'Connect bank',
      tab: 'overview',
      scrollTo: 'dashboard-actions',
    })
  }

  if (highlightGenerate) {
    items.push({
      id: 'first-insight',
      tone: 'brand',
      title: 'Ready for your first insight',
      detail: 'Your accounts are synced — tap Generate Insights on the Insight tab to see what Soverm finds.',
      actionLabel: 'Generate Insights',
      tab: 'insight',
      scrollTo: 'generate-insight-action-insight',
    })
  }

  if (hasAccounts && hoursSinceSync(lastSyncedAt) >= SYNC_STALE_HOURS) {
    items.push({
      id: 'stale-sync',
      tone: 'warning',
      title: 'Transactions may be out of date',
      detail: lastSyncedAt
        ? 'Your last sync was over a day ago — refresh for the latest activity.'
        : 'Sync to pull your latest transactions into Soverm.',
      actionLabel: 'Sync now',
      tab: 'overview',
      scrollTo: 'dashboard-actions',
    })
  }

  if (incompleteActionCount > 0) {
    items.push({
      id: 'pending-actions',
      tone: 'brand',
      title: `${incompleteActionCount} insight action${incompleteActionCount === 1 ? '' : 's'} pending`,
      detail: 'Follow through on the steps from your latest Soverm insight.',
      actionLabel: 'View actions',
      tab: 'insight',
      scrollTo: 'dashboard-insight-actions',
    })
  }

  return items
}
