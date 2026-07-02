/*
 * End-to-end verification for all five MoM hardening fixes.
 * Simulates generate → enforce → persist → history reload without Claude/DB.
 *
 * Usage: node scripts/test-mom-integration.js
 */

import {
  buildPersistedInsightContent,
  enforceStatDeltas,
  inferStatType,
} from '../services/claude.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function handCalculateDelta(current, prior) {
  if (prior === 0) {
    if (current === 0) {
      return { direction: 'flat', percent: 0 }
    }
    return { direction: 'up', percent: null, isNew: true }
  }

  const rawPercent = Math.round(((current - prior) / prior) * 100)
  if (rawPercent === 0) {
    return { direction: 'flat', percent: 0 }
  }

  return {
    direction: rawPercent > 0 ? 'up' : 'down',
    percent: Math.abs(rawPercent),
  }
}

function simulateHistoryReload(persistedContentJson) {
  const row = { id: 'test-id', content: persistedContentJson, created_at: new Date().toISOString() }
  const parsed = JSON.parse(row.content)
  return { ...parsed, id: row.id, created_at: row.created_at }
}

let passed = 0

try {
  console.log('MoM integration verification (all five fixes)\n')

  const monthOverMonthComparison = {
    hasComparisonData: true,
    currentPeriod: {
      spending: {
        total: 3287,
        byCategory: {
          'Food and Drink': 842,
          Shopping: 615,
          Travel: 210,
        },
      },
      income: { total: 5200 },
    },
    priorPeriod: {
      spending: {
        total: 2797,
        byCategory: {
          'Food and Drink': 712,
          Shopping: 520,
          Travel: 195,
        },
      },
      income: { total: 4800 },
    },
  }

  const claudeRaw = {
    headline: 'Dining spend is climbing',
    headlineType: 'warning',
    stats: [
      {
        label: 'Dining',
        value: '$842',
        detail: 'Largest expense category',
        statType: 'spending',
        delta: { direction: 'down', percent: 99, vsLabel: 'vs last month' },
      },
      {
        label: 'Monthly Income',
        value: '$5,200',
        detail: 'Paycheck deposits',
        statType: 'spending',
        delta: { direction: 'up', percent: 10, vsLabel: 'vs last month' },
      },
      {
        label: 'Liquid Cash',
        value: '$9,100',
        detail: 'Checking plus savings',
        statType: 'spending',
        delta: { direction: 'up', percent: 5, vsLabel: 'vs last month' },
      },
    ],
    fullSummary: ['One', 'Two', 'Three'],
    actions: ['Action one'],
  }

  const enforced = enforceStatDeltas(claudeRaw, monthOverMonthComparison)

  const diningExpected = handCalculateDelta(842, 712)
  assert(enforced.stats[0].delta.direction === diningExpected.direction, 'Dining direction mismatch')
  assert(enforced.stats[0].delta.percent === diningExpected.percent, 'Dining percent mismatch')
  console.log(
    `  pass: [1] delta math spot-check — Dining $842 vs $712 → ${diningExpected.direction} ${diningExpected.percent}% (hand-calculated)`
  )
  passed++

  const totalExpected = handCalculateDelta(3287, 2797)
  const overallEnforced = enforceStatDeltas(
    {
      stats: [
        {
          label: 'Total Spend',
          value: '$3,287',
          detail: 'All expenses',
          delta: { direction: 'flat', percent: 0, vsLabel: 'vs last month' },
        },
      ],
    },
    monthOverMonthComparison
  )
  assert(overallEnforced.stats[0].delta.percent === totalExpected.percent, 'Overall percent mismatch')
  console.log(
    `  pass: [1] overall spending spot-check — $3287 vs $2797 → ${totalExpected.direction} ${totalExpected.percent}%`
  )
  passed++

  for (const stat of enforced.stats) {
    if (stat.delta) {
      assert(
        stat.delta.vsLabel === 'vs prior 30 days',
        `Stat "${stat.label}" still has old vsLabel: ${stat.delta.vsLabel}`
      )
    }
  }
  assert(!JSON.stringify(enforced).includes('vs last month'), 'Stale "vs last month" copy found in enforced insight')
  console.log('  pass: [2] all enforced deltas use "vs prior 30 days" copy')
  passed++

  assert(inferStatType(enforced.stats[1]) === 'income', 'Income stat not classified as income')
  assert(enforced.stats[1].statType === 'income', 'Income statType not enforced on save path')
  const incomeExpected = handCalculateDelta(5200, 4800)
  assert(enforced.stats[1].delta?.percent === incomeExpected.percent, 'Income delta percent mismatch')
  assert(enforced.stats[1].delta?.direction === incomeExpected.direction, 'Income delta direction mismatch')
  console.log(
    `  pass: [3] income stat tagged and delta populated — $5200 vs $4800 → ${incomeExpected.direction} ${incomeExpected.percent}%`
  )
  passed++

  const persisted = buildPersistedInsightContent(enforced, monthOverMonthComparison)
  const reloaded = simulateHistoryReload(JSON.stringify(persisted))

  assert(reloaded.stats[0].delta?.percent === diningExpected.percent, 'History reload lost dining delta')
  assert(
    reloaded.monthOverMonthComparison?.priorPeriod?.spending?.byCategory?.['Food and Drink'] === 712,
    'History reload lost MoM snapshot'
  )
  assert(reloaded.stats[2].delta === null, 'Neutral stat should still have null delta after reload')
  console.log('  pass: [4] history reload preserves deltas and MoM snapshot (no recalculation)')
  passed++

  const noPrior = enforceStatDeltas(claudeRaw, {
    hasComparisonData: false,
    currentPeriod: {
      spending: { total: 1000, byCategory: { Dining: 500 } },
      income: { total: 0 },
    },
    priorPeriod: {
      spending: { total: 0, byCategory: {} },
      income: { total: 0 },
    },
  })
  const persistedNoPrior = buildPersistedInsightContent(noPrior, {
    hasComparisonData: false,
    currentPeriod: {
      spending: { total: 1000, byCategory: { Dining: 500 } },
      income: { total: 0 },
    },
    priorPeriod: {
      spending: { total: 0, byCategory: {} },
      income: { total: 0 },
    },
  })

  for (const stat of noPrior.stats) {
    assert(stat.delta === null, `New user stat "${stat.label}" should have delta null, got ${JSON.stringify(stat.delta)}`)
  }
  assert(persistedNoPrior.monthOverMonthComparison?.hasComparisonData === false, 'Snapshot should record no comparison')
  const reloadedNoPrior = simulateHistoryReload(JSON.stringify(persistedNoPrior))
  assert(reloadedNoPrior.stats.every((s) => s.delta === null), 'Reloaded new-user insight should have no deltas')
  console.log('  pass: [5] no prior period → all deltas null, no errors on persist/reload')
  passed++

  console.log(`\n${passed}/${passed} integration checks passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
