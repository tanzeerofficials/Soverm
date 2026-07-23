/*
 * Verifies server-side delta enforcement overwrites Claude-returned deltas
 * with pre-computed values (or null when no verified match exists).
 *
 * Usage: node scripts/test-delta-enforcement.js
 */

import 'dotenv/config'
import { enforceStatDeltas } from '../services/claude.js'
import { test } from 'node:test'

const sampleComparison = {
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

const emptyComparison = {
  hasComparisonData: false,
  currentPeriod: {
    spending: { total: 0, byCategory: {} },
    income: { total: 0 },
  },
  priorPeriod: {
    spending: { total: 0, byCategory: {} },
    income: { total: 0 },
  },
}

function assertEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\n  expected: ${expectedJson}\n  actual:   ${actualJson}`)
  }
}

function runCase(name, insight, comparison, expectations) {
  const result = enforceStatDeltas(insight, comparison)

  for (const [index, expectedDelta] of expectations.entries()) {
    assertEqual(
      result.stats[index].delta,
      expectedDelta,
      `${name} — stat[${index}] ("${insight.stats[index].label}")`
    )
  }

  console.log(`  pass: ${name}`)
}

let passed = 0

test('delta enforcement', () => {
  console.log('Delta enforcement tests\n')

  runCase(
    'overwrites wrong Claude delta for overall spending',
    {
      stats: [
        {
          label: 'Total Spend',
          value: '$3,287',
          detail: 'All expenses this month',
          delta: { direction: 'down', percent: 99, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    sampleComparison,
    [
      {
        direction: 'up',
        percent: 18,
        times: 1.18,
        absoluteChange: 490,
        currentTotal: 3287,
        priorTotal: 2797,
        vsLabel: 'vs prior 30 days',
      },
    ]
  )
  passed++

  runCase(
    'fuzzy match: Dining label maps to Food and Drink category',
    {
      stats: [
        {
          label: 'Dining',
          value: '$842',
          detail: 'Largest discretionary category',
          delta: { direction: 'flat', percent: 0, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    sampleComparison,
    [
      {
        direction: 'up',
        percent: 18,
        times: 1.18,
        absoluteChange: 130,
        currentTotal: 842,
        priorTotal: 712,
        vsLabel: 'vs prior 30 days',
      },
    ]
  )
  passed++

  runCase(
    'income stat gets overall income delta (not spending)',
    {
      stats: [
        {
          label: 'Monthly Income',
          value: '$5,200',
          detail: 'Paycheck deposits',
          delta: { direction: 'down', percent: 12, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    sampleComparison,
    [
      {
        direction: 'up',
        percent: 8,
        times: 1.08,
        absoluteChange: 400,
        currentTotal: 5200,
        priorTotal: 4800,
        vsLabel: 'vs prior 30 days',
      },
    ]
  )
  passed++

  runCase(
    'null when no verified match (liquid cash stat)',
    {
      stats: [
        {
          label: 'Liquid Cash',
          value: '$4,200',
          detail: 'Checking plus savings',
          delta: { direction: 'up', percent: 12, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    sampleComparison,
    [null]
  )
  passed++

  runCase(
    'all deltas null when comparison data unavailable',
    {
      stats: [
        {
          label: 'Dining',
          value: '$842',
          detail: 'Top category',
          delta: { direction: 'up', percent: 18, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    emptyComparison,
    [null]
  )
  passed++

  runCase(
    'mixed stats: one matched, one unmatched',
    {
      stats: [
        {
          label: 'Shopping',
          value: '$615',
          detail: 'Retail purchases',
          delta: { direction: 'down', percent: 5, vsLabel: 'vs prior 30 days' },
        },
        {
          label: 'Credit Utilization',
          value: '42%',
          detail: 'Across active cards',
          delta: { direction: 'up', percent: 3, vsLabel: 'vs prior 30 days' },
        },
      ],
    },
    sampleComparison,
    [
      {
        direction: 'up',
        percent: 18,
        times: 1.18,
        absoluteChange: 95,
        currentTotal: 615,
        priorTotal: 520,
        vsLabel: 'vs prior 30 days',
      },
      null,
    ]
  )
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
})
