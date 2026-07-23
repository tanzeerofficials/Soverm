/*
 * Verifies insight persistence includes enforced stats and frozen MoM snapshot.
 *
 * Usage: node scripts/test-insight-persistence.js
 */

import 'dotenv/config'
import { buildPersistedInsightContent } from '../services/claude.js'
import { test } from 'node:test'

const sampleComparison = {
  hasComparisonData: true,
  currentPeriod: {
    spending: {
      total: 3287,
      byCategory: { Dining: 842 },
    },
    income: { total: 5200 },
  },
  priorPeriod: {
    spending: {
      total: 2797,
      byCategory: { Dining: 712 },
    },
    income: { total: 4800 },
  },
}

const sampleInsight = {
  headline: 'Spending is up',
  headlineType: 'warning',
  stats: [
    {
      label: 'Dining',
      value: '$842',
      detail: 'Top category',
      statType: 'spending',
      delta: { direction: 'up', percent: 18, vsLabel: 'vs prior 30 days' },
    },
  ],
  fullSummary: ['Paragraph one', 'Paragraph two', 'Paragraph three'],
  actions: ['Cut dining by $100'],
  extraClaudeField: 'should not persist',
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test('insight persistence', () => {
  console.log('Insight persistence tests\n')

  const persisted = buildPersistedInsightContent(sampleInsight, sampleComparison, {
    transactionCount: 47,
    generatedAt: '2026-07-02T13:06:00.000Z',
  })

  assert(persisted.headline === sampleInsight.headline, 'headline preserved')
  assert(persisted.stats[0].delta.percent === 18, 'enforced stat delta preserved')
  assert(persisted.stats[0].statType === 'spending', 'statType preserved')
  console.log('  pass: core insight fields and enforced deltas preserved')

  assert(
    persisted.monthOverMonthComparison?.currentPeriod?.spending?.total === 3287,
    'current spending total snapshot missing'
  )
  assert(
    persisted.monthOverMonthComparison?.currentPeriod?.income?.total === 5200,
    'current income total snapshot missing'
  )
  assert(
    persisted.monthOverMonthComparison?.priorPeriod?.spending?.byCategory?.Dining === 712,
    'prior category snapshot missing'
  )
  assert(
    typeof persisted.monthOverMonthComparison?.capturedAt === 'string',
    'capturedAt timestamp missing'
  )
  console.log('  pass: monthOverMonthComparison snapshot attached')

  assert(persisted.extraClaudeField === undefined, 'unexpected fields must not leak into storage')
  console.log('  pass: only canonical fields persisted')

  assert(persisted.metadata?.generatedAt === '2026-07-02T13:06:00.000Z', 'generatedAt missing')
  assert(persisted.metadata?.transactionCount === 47, 'transactionCount missing')
  assert(persisted.metadata?.comparisonWindow === '30d', 'comparisonWindow missing')
  console.log('  pass: generation metadata attached')

  const withoutComparison = buildPersistedInsightContent(sampleInsight, null, {
    transactionCount: 12,
  })
  assert(withoutComparison.monthOverMonthComparison === null, 'null comparison when unavailable')
  assert(withoutComparison.metadata?.transactionCount === 12, 'metadata preserved without MoM')
  console.log('  pass: null snapshot when no comparison data')

  passed = 5
  console.log(`\n${passed}/${passed} tests passed`)
})
