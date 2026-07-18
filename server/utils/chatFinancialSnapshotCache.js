/*
 * CHAT FINANCIAL SNAPSHOT CACHE
 *
 * What this does: remembers the expensive Ask Soverm finance snapshot per user
 * for a short time so back-to-back chat messages do not rebuild it every turn.
 *
 * Why: between Plaid syncs the DB numbers do not get "fresher" — recomputing
 * Expense Analyzer + MoM on every message is mostly duplicate work.
 *
 * How freshness stays correct:
 * - Entries are keyed by last_synced_at (syncKey). A new sync misses the cache.
 * - invalidateChatFinancialSnapshot(userId) clears the entry when app-side
 *   money settings change (soft limits, payday, disconnect, trackers, …).
 * - A TTL is a safety net if something forgets to invalidate.
 */

/** Default: keep a snapshot for a few minutes of active chatting. */
export const CHAT_FINANCIAL_SNAPSHOT_TTL_MS = 3 * 60 * 1000

const snapshotByUserId = new Map()
const inflightByUserId = new Map()

function toSyncKey(lastSyncedAt) {
  if (!lastSyncedAt) {
    return 'none'
  }
  const date = lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt)
  if (Number.isNaN(date.getTime())) {
    return 'none'
  }
  return date.toISOString()
}

/*
 * What this does: returns a cached snapshot when syncKey matches and TTL is fresh.
 */
export function getChatFinancialSnapshot(userId, lastSyncedAt, now = Date.now()) {
  if (!userId) {
    return null
  }

  const entry = snapshotByUserId.get(userId)
  if (!entry) {
    return null
  }

  const syncKey = toSyncKey(lastSyncedAt)
  if (entry.syncKey !== syncKey) {
    snapshotByUserId.delete(userId)
    return null
  }

  if (now - entry.builtAtMs > CHAT_FINANCIAL_SNAPSHOT_TTL_MS) {
    snapshotByUserId.delete(userId)
    return null
  }

  return entry.snapshot
}

/*
 * What this does: stores a freshly built snapshot for this user + sync moment.
 */
export function setChatFinancialSnapshot(userId, lastSyncedAt, snapshot, now = Date.now()) {
  if (!userId || !snapshot) {
    return
  }

  snapshotByUserId.set(userId, {
    syncKey: toSyncKey(lastSyncedAt),
    builtAtMs: now,
    snapshot,
  })
}

/*
 * What this does: drops one user's cached snapshot (and any in-flight build).
 * Why: soft limits / payday / disconnect change the snapshot without a new sync.
 */
export function invalidateChatFinancialSnapshot(userId) {
  if (!userId) {
    return
  }
  snapshotByUserId.delete(userId)
  inflightByUserId.delete(userId)
}

/** Test helper — clears the whole process cache. */
export function clearChatFinancialSnapshotCache() {
  snapshotByUserId.clear()
  inflightByUserId.clear()
}

export function getChatFinancialSnapshotCacheSize() {
  return snapshotByUserId.size
}

/*
 * What this does: if two chat requests miss at once, they share one build promise.
 * Why: avoids double Expense Analyzer work on rapid double-send / Retry.
 */
export async function withChatFinancialSnapshotInflight(userId, buildFn) {
  if (!userId) {
    return buildFn()
  }

  const existing = inflightByUserId.get(userId)
  if (existing) {
    return existing
  }

  const pending = Promise.resolve()
    .then(buildFn)
    .finally(() => {
      if (inflightByUserId.get(userId) === pending) {
        inflightByUserId.delete(userId)
      }
    })

  inflightByUserId.set(userId, pending)
  return pending
}

export { toSyncKey }
