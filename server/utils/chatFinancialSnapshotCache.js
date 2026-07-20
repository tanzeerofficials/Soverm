/*
 * CHAT FINANCIAL SNAPSHOT CACHE
 *
 * What this does: remembers the expensive Ask Soverm finance snapshot per user
 * for a short time so back-to-back chat messages do not rebuild it every turn.
 *
 * Why: between Plaid syncs the DB numbers do not get "fresher" — recomputing
 * Expense Analyzer + MoM on every message is mostly duplicate work.
 *
 * How freshness stays correct across multiple server replicas:
 * - Entries are keyed by last_synced_at (syncKey) AND users.chat_context_epoch.
 * - invalidateChatFinancialSnapshot bumps the epoch in Postgres so every
 *   replica misses its in-memory entry even though last_synced_at is unchanged
 *   (soft limits, payday, trackers, disconnect, …).
 * - A TTL is a safety net if something forgets to invalidate.
 *
 * Disable with CHAT_FINANCIAL_SNAPSHOT_CACHE=0 (always rebuild).
 */

import db from '../db/index.js'

/** Default: keep a snapshot for a few minutes of active chatting. */
export const CHAT_FINANCIAL_SNAPSHOT_TTL_MS = 3 * 60 * 1000

const snapshotByUserId = new Map()
const inflightByUserId = new Map()

function isCacheEnabled() {
  const flag = process.env.CHAT_FINANCIAL_SNAPSHOT_CACHE
  if (flag === '0' || flag === 'false' || flag === 'off') {
    return false
  }
  return true
}

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

function cacheKey(syncKey, epoch) {
  return `${syncKey}::e${Number(epoch) || 0}`
}

export async function loadChatContextEpoch(userId) {
  if (!userId) {
    return 0
  }

  try {
    const result = await db.query(
      `SELECT chat_context_epoch
       FROM users
       WHERE id = $1`,
      [userId]
    )
    return Number(result.rows[0]?.chat_context_epoch ?? 0)
  } catch (err) {
    // Migration 028 not applied yet — treat as epoch 0.
    if (err.code === '42703') {
      return 0
    }
    throw err
  }
}

/*
 * What this does: returns a cached snapshot when syncKey+epoch match and TTL is fresh.
 */
export function getChatFinancialSnapshot(
  userId,
  lastSyncedAt,
  epoch = 0,
  now = Date.now()
) {
  if (!userId || !isCacheEnabled()) {
    return null
  }

  const entry = snapshotByUserId.get(userId)
  if (!entry) {
    return null
  }

  const expectedKey = cacheKey(toSyncKey(lastSyncedAt), epoch)
  if (entry.key !== expectedKey) {
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
 * What this does: stores a freshly built snapshot for this user + sync + epoch.
 */
export function setChatFinancialSnapshot(
  userId,
  lastSyncedAt,
  snapshot,
  epoch = 0,
  now = Date.now()
) {
  if (!userId || !snapshot || !isCacheEnabled()) {
    return
  }

  snapshotByUserId.set(userId, {
    key: cacheKey(toSyncKey(lastSyncedAt), epoch),
    builtAtMs: now,
    snapshot,
  })
}

/*
 * What this does: drops one user's cached snapshot and bumps the shared epoch
 * so other replicas also miss on their next chat turn.
 */
export function invalidateChatFinancialSnapshot(userId) {
  if (!userId) {
    return
  }
  snapshotByUserId.delete(userId)
  inflightByUserId.delete(userId)

  db.query(
    `UPDATE users
     SET chat_context_epoch = chat_context_epoch + 1
     WHERE id = $1`,
    [userId]
  ).catch((err) => {
    // 42703 = column missing (pre-028); 42P01 = no users table (unit tests)
    if (err.code !== '42703' && err.code !== '42P01') {
      console.warn(
        `[chat-snapshot-cache] failed to bump chat_context_epoch for ${userId}:`,
        err.message
      )
    }
  })
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
