/**
 * Unit tests for dashboard attention rules.
 * Run: node scripts/test-dashboard-attention.js
 */

import {
  buildAttentionItems,
  buildTrackerAttentionItems,
  countIncompleteActions,
  daysSince,
  getInsightFreshnessNudge,
  hoursSinceSync,
  summarizeInsightActions,
  INSIGHT_STALE_DAYS,
  SYNC_STALE_HOURS,
} from '../src/lib/dashboardAttention.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const now = Date.now()
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString()
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString()

console.log('dashboardAttention tests\n')

assert(countIncompleteActions([{ completed: true }, { completed: false }]) === 1, 'incomplete count')
assert(summarizeInsightActions([]).total === 0, 'empty actions summary')

const staleSyncItems = buildAttentionItems({
  hasAccounts: true,
  hasInsight: true,
  highlightGenerate: false,
  lastSyncedAt: hoursAgo(SYNC_STALE_HOURS + 1),
  incompleteActionCount: 0,
})
assert(staleSyncItems.some((item) => item.id === 'stale-sync'), 'flags stale sync')

const freshness = getInsightFreshnessNudge(daysAgo(INSIGHT_STALE_DAYS + 1), {
  hasInsight: true,
})
assert(freshness?.dayCount >= INSIGHT_STALE_DAYS, 'freshness nudge when insight is stale')

const freshInsight = getInsightFreshnessNudge(daysAgo(1), { hasInsight: true })
assert(freshInsight === null, 'no freshness nudge for recent insight')

const setupItems = buildAttentionItems({
  hasAccounts: false,
  hasInsight: false,
  highlightGenerate: false,
  lastSyncedAt: null,
  incompleteActionCount: 0,
})
assert(setupItems.some((item) => item.id === 'connect-bank'), 'prompts bank connect')

const firstInsightItems = buildAttentionItems({
  hasAccounts: true,
  hasInsight: false,
  highlightGenerate: true,
  lastSyncedAt: hoursAgo(1),
  incompleteActionCount: 0,
})
const firstInsight = firstInsightItems.find((item) => item.id === 'first-insight')
assert(firstInsight?.tab === 'insight', 'first insight points to insight tab')
assert(firstInsight?.scrollTo === 'generate-insight-action-insight', 'first insight scroll target')

assert(hoursSinceSync(hoursAgo(2)) >= 2, 'hours since sync')
assert(daysSince(daysAgo(3)) >= 3, 'days since insight')

const overCap = buildTrackerAttentionItems({
  spendingTracker: {
    name: 'Monthly spending',
    monthlyAmount: 1500,
    progress: {
      spent: 1700,
      isOver: true,
      overBy: 200,
      percentUsed: 113,
    },
  },
  periodLabel: 'Jul 1–today',
})
assert(overCap.length === 1 && overCap[0].id === 'spending-cap-over', 'flags over spending cap')
assert(overCap[0].quickToolTab === 'tracker', 'over cap links to tracker tab')

const warningCap = buildTrackerAttentionItems({
  spendingTracker: {
    name: 'Monthly spending',
    monthlyAmount: 1500,
    progress: {
      spent: 1250,
      isOver: false,
      percentUsed: 83,
      remaining: 250,
    },
  },
  periodLabel: 'Jul 1–today',
})
assert(warningCap.length === 1 && warningCap[0].id === 'spending-cap-warning', 'flags cap warning')

const attentionWithTracker = buildAttentionItems({
  hasAccounts: true,
  hasInsight: true,
  highlightGenerate: false,
  lastSyncedAt: hoursAgo(1),
  incompleteActionCount: 0,
  trackerSnapshot: {
    spendingTracker: warningCap[0] ? {
      name: 'Monthly spending',
      monthlyAmount: 1500,
      progress: { spent: 1250, isOver: false, percentUsed: 83, remaining: 250 },
    } : null,
    periodLabel: 'Jul 1–today',
  },
})
assert(attentionWithTracker.some((item) => item.id === 'spending-cap-warning'), 'includes tracker alert in attention list')

console.log('All dashboardAttention tests passed.')
