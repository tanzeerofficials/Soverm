/**
 * Offline unit checks for Ask Soverm finance snapshot cache.
 *
 * Usage: node scripts/test-chat-financial-snapshot-cache.js
 */

import assert from 'node:assert/strict'
import {
  CHAT_FINANCIAL_SNAPSHOT_TTL_MS,
  clearChatFinancialSnapshotCache,
  getChatFinancialSnapshot,
  getChatFinancialSnapshotCacheSize,
  invalidateChatFinancialSnapshot,
  setChatFinancialSnapshot,
  withChatFinancialSnapshotInflight,
} from '../utils/chatFinancialSnapshotCache.js'

clearChatFinancialSnapshotCache()

const userId = 'user_test_cache'
const syncAt = '2026-07-18T12:00:00.000Z'
const snapshot = { capturedAt: '2026-07-18T12:01:00.000Z', accounts: { items: [] } }
const epoch = 0

assert.equal(getChatFinancialSnapshot(userId, syncAt, epoch), null, 'empty cache misses')

setChatFinancialSnapshot(
  userId,
  syncAt,
  snapshot,
  epoch,
  Date.parse('2026-07-18T12:01:00.000Z')
)
assert.equal(getChatFinancialSnapshotCacheSize(), 1)

const hit = getChatFinancialSnapshot(
  userId,
  syncAt,
  epoch,
  Date.parse('2026-07-18T12:01:00.000Z') + 30_000
)
assert.deepEqual(hit, snapshot, 'fresh syncKey hits')

assert.equal(
  getChatFinancialSnapshot(userId, '2026-07-18T13:00:00.000Z', epoch),
  null,
  'new sync key misses and clears stale entry'
)
assert.equal(getChatFinancialSnapshotCacheSize(), 0, 'stale sync clears entry')

setChatFinancialSnapshot(
  userId,
  syncAt,
  snapshot,
  epoch,
  Date.parse('2026-07-18T12:01:00.000Z')
)
assert.equal(
  getChatFinancialSnapshot(
    userId,
    syncAt,
    epoch,
    Date.parse('2026-07-18T12:01:00.000Z') + CHAT_FINANCIAL_SNAPSHOT_TTL_MS + 1
  ),
  null,
  'expired TTL misses'
)

setChatFinancialSnapshot(userId, syncAt, snapshot, epoch)
assert.equal(
  getChatFinancialSnapshot(userId, syncAt, epoch + 1),
  null,
  'epoch bump (other replica invalidate) misses'
)

setChatFinancialSnapshot(userId, syncAt, snapshot, epoch)
invalidateChatFinancialSnapshot(userId)
assert.equal(getChatFinancialSnapshot(userId, syncAt, epoch), null, 'invalidate clears')
assert.equal(getChatFinancialSnapshotCacheSize(), 0)

let builds = 0
const shared = withChatFinancialSnapshotInflight(userId, async () => {
  builds += 1
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { builds }
})
const shared2 = withChatFinancialSnapshotInflight(userId, async () => {
  builds += 1
  return { builds: 'should-not-run' }
})

const [a, b] = await Promise.all([shared, shared2])
assert.equal(builds, 1, 'inflight dedupes concurrent builds')
assert.equal(a, b, 'inflight callers share the same promise result')

clearChatFinancialSnapshotCache()
console.log('chat financial snapshot cache tests passed.')
