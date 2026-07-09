/*
 * Dismissed "Needs attention" items — stored in localStorage.
 *
 * Each dismissal is keyed by item id + a fingerprint of the current situation.
 * When the situation changes (sync refreshed, new month, fewer pending actions),
 * the item can appear again even if the user dismissed it before.
 */

export const ATTENTION_DISMISSALS_KEY = 'soverm:attention-dismissals'

function readDismissals() {
  try {
    const raw = localStorage.getItem(ATTENTION_DISMISSALS_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDismissals(dismissals) {
  try {
    localStorage.setItem(ATTENTION_DISMISSALS_KEY, JSON.stringify(dismissals))
  } catch {
    // localStorage unavailable
  }
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
    case 'spending-cap-warning':
      return context.trackerPeriodStart ?? 'unknown-month'
    case 'stale-sync':
      return context.lastSyncedAt ?? 'never-synced'
    case 'pending-actions':
      return String(context.incompleteActionCount ?? 0)
    case 'connect-bank':
      return 'needs-bank'
    case 'first-insight':
      return 'needs-insight'
    default:
      return 'default'
  }
}

export function isAttentionItemDismissed(item, context = {}) {
  const dismissals = readDismissals()
  const fingerprint = getAttentionItemFingerprint(item, context)
  return dismissals[item.id] === fingerprint
}

export function dismissAttentionItem(item, context = {}) {
  const dismissals = readDismissals()
  dismissals[item.id] = getAttentionItemFingerprint(item, context)
  writeDismissals(dismissals)
}

export function filterDismissedAttentionItems(items, context = {}) {
  return items.filter((item) => !isAttentionItemDismissed(item, context))
}

/** Test helper */
export function clearAttentionDismissals() {
  try {
    localStorage.removeItem(ATTENTION_DISMISSALS_KEY)
  } catch {
    // ignore
  }
}
