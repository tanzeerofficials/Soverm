/*
 * Verifies statType inference and enforcement on insight stats.
 *
 * Usage: node scripts/test-stat-type.js
 */

import 'dotenv/config'
import { enforceStatDeltas, inferStatType } from '../services/claude.js'
import { test } from 'node:test'

const sampleComparison = {
  hasComparisonData: true,
  currentPeriod: {
    spending: {
      total: 3287,
      byCategory: { 'Food and Drink': 842 },
    },
    income: { total: 5200 },
  },
  priorPeriod: {
    spending: {
      total: 2797,
      byCategory: { 'Food and Drink': 712 },
    },
    income: { total: 4800 },
  },
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  expected: ${expected}\n  actual:   ${actual}`)
  }
}

let passed = 0

test('stat type', () => {
  console.log('Stat type tests\n')

  assertEqual(inferStatType({ label: 'Monthly Income', value: '$4,200' }), 'income', 'income label')
  passed++
  console.log('  pass: income label')

  assertEqual(
    inferStatType({ label: 'Dining', value: '$842', detail: 'Top expense' }),
    'spending',
    'spending label'
  )
  passed++
  console.log('  pass: spending label')

  assertEqual(
    inferStatType({ label: 'Liquid Cash', value: '$9,100' }),
    'neutral',
    'neutral label'
  )
  passed++
  console.log('  pass: neutral label')

  const enforced = enforceStatDeltas(
    {
      stats: [
        { label: 'Paycheck Total', value: '$5,000', detail: 'Deposits this period', statType: 'spending' },
        { label: 'Dining', value: '$842', detail: 'Largest expense', statType: 'income' },
      ],
    },
    sampleComparison
  )

  assertEqual(enforced.stats[0].statType, 'income', 'enforce overwrites wrong income statType')
  passed++
  console.log('  pass: enforce overwrites wrong statType on income stat')

  assertEqual(enforced.stats[1].statType, 'spending', 'enforce overwrites wrong spending statType')
  passed++
  console.log('  pass: enforce overwrites wrong statType on spending stat')

  console.log(`\n${passed}/${passed} tests passed`)
})
