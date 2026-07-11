/*
 * Dismissed "Needs attention" items — stored in localStorage.
 *
 * Each dismissal is keyed by item id + a fingerprint of the current situation.
 * When the situation changes (sync refreshed, new month, fewer pending actions),
 * the item can appear again even if the user dismissed it before.
 *
 * Storage is scoped by Clerk userId when provided (see userScopedStorage.js).
 */

import {
  readUserScopedJson,
  removeUserScopedKey,
  writeUserScopedJson,
} from './userScopedStorage.js'

export const ATTENTION_DISMISSALS_KEY = 'soverm:attention-dismissals'

function readDismissals(userId) {
  return readUserScopedJson(ATTENTION_DISMISSALS_KEY, userId, {})
}

function writeDismissals(dismissals, userId) {
  writeUserScopedJson(ATTENTION_DISMISSALS_KEY, userId, dismissals)
}

/**
 * Returns a stable string for the item's current situation — used to decide
 * whether a past dismissal still applies.
 */
export function getAttentionItemFingerprint(item, context = {}) {
  if (item.notificationId) {
    return item.notificationId
  }

  switch (item.id) {
    case 'spending-cap-over':
    case 'spending-cap-warning': {
      // Include spend severity so dismissing at 83% still resurfaces at 95% / over.
      const period = context.trackerPeriodStart ?? 'unknown-month'
      const percent = Math.round(Number(context.percentUsed ?? 0))
      const overBucket = context.isOverBudget
        ? `over:${Math.round(Number(context.overBudgetBy ?? 0))}`
        : 'under'
      return `${period}:${percent}:${overBucket}`
    }
    case 'stale-sync':
      return context.lastSyncedAt ?? 'never-synced'
    case 'pending-actions':
      return String(context.incompleteActionCount ?? 0)
    case 'connect-bank':
      return 'needs-bank'
    case 'first-insight':
      return 'needs-insight'
    default:
      if (typeof item.id === 'string' && item.id.startsWith('savings-detection-')) {
        return item.detectionId ?? item.id
      }
      return 'default'
  }
}

export function isAttentionItemDismissed(item, context = {}, userId) {
  const dismissals = readDismissals(userId)
  const fingerprint = getAttentionItemFingerprint(item, context)
  return dismissals[item.id] === fingerprint
}

export function dismissAttentionItem(item, context = {}, userId) {
  const dismissals = readDismissals(userId)
  dismissals[item.id] = getAttentionItemFingerprint(item, context)
  writeDismissals(dismissals, userId)
}

export function filterDismissedAttentionItems(items, context = {}, userId) {
  return items.filter((item) => !isAttentionItemDismissed(item, context, userId))
}

/** Test helper */
export function clearAttentionDismissals(userId) {
  removeUserScopedKey(ATTENTION_DISMISSALS_KEY, userId)
  if (userId) {
    removeUserScopedKey(ATTENTION_DISMISSALS_KEY, null)
  }
}
