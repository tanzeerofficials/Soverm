/*
 * Dashboard "needs attention" rules — pure helpers to decide what to surface
 * on the Overview tab (notifications, stale sync, pending actions, etc.).
 */

import {
  notificationActionLabel,
} from './notificationNavigation.js'

export const INSIGHT_STALE_DAYS = 5
export const SYNC_STALE_HOURS = 24
export const MAX_NOTIFICATION_ITEMS = 2

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
  hasInsight,
  highlightGenerate,
  lastSyncedAt,
  incompleteActionCount,
  unreadNotifications = [],
  proactiveEnabled = true,
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
      detail: 'Your accounts are synced — tap Generate Summary below to see what Soverm finds.',
      actionLabel: 'Generate insight',
      tab: 'overview',
      scrollTo: 'generate-insight-action',
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
