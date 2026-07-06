/*
 * Verifies getCategoryBreakdownWithDeltas and shared computeSpendingDelta logic.
 *
 * Usage: node scripts/test-category-breakdown-deltas.js
 */

import 'dotenv/config'
import {
  buildCategoryBreakdownFromComparison,
  computeSpendingDelta,
  getCategoryBreakdownWithDeltas,
} from '../utils/financialContext.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Category breakdown delta tests\n')

  const comparison = {
    hasComparisonData: true,
    currentPeriod: {
      spending: {
        total: 3287,
        byCategory: {
          'Food and Drink': 842,
          Shopping: 615,
          Travel: 210,
          Subscriptions: 45,
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

  const breakdown = buildCategoryBreakdownFromComparison(comparison)
  const publicBreakdown = breakdown.map(
    ({ category, currentTotal, priorTotal, spendingDelta }) => ({
      category,
      currentTotal,
      priorTotal,
      delta:
        !spendingDelta || spendingDelta.isNewCategory
          ? null
          : { direction: spendingDelta.direction, percent: spendingDelta.percent },
    })
  )

  assert(breakdown.length === 4, `Expected 4 categories, got ${breakdown.length}`)
  console.log('  pass: merges current and prior category keys')
  passed++

  const dining = publicBreakdown.find((row) => row.category === 'Food and Drink')
  assert(dining.currentTotal === 842, 'Dining current total mismatch')
  assert(dining.priorTotal === 712, 'Dining prior total mismatch')
  assert(dining.delta.direction === 'up', 'Dining direction mismatch')
  assert(dining.delta.percent === 18, 'Dining percent mismatch')
  console.log('  pass: Dining $842 vs $712 → up 18%')
  passed++

  const subscriptions = publicBreakdown.find((row) => row.category === 'Subscriptions')
  assert(subscriptions.delta === null, 'No prior category spend → delta null')
  console.log('  pass: category with no prior spend → delta null')
  passed++

  assert(
    publicBreakdown[0].category === 'Food and Drink',
    `Biggest mover should be Food and Drink, got ${publicBreakdown[0].category}`
  )
  assert(
    publicBreakdown.at(-1).category === 'Subscriptions',
    'New category with null delta should sort after percent movers'
  )
  console.log('  pass: sorted by absolute percent change descending')
  passed++

  const noPrior = buildCategoryBreakdownFromComparison({
    hasComparisonData: false,
    currentPeriod: {
      spending: {
        total: 500,
        byCategory: { Dining: 500 },
      },
      income: { total: 0 },
    },
    priorPeriod: {
      spending: { total: 0, byCategory: {} },
      income: { total: 0 },
    },
  })

  assert(noPrior.length === 1, 'Should still return current categories')
  assert(noPrior[0].spendingDelta === null, 'No prior period → delta null, not a crash')
  console.log('  pass: no prior-period data → delta null')
  passed++

  const flat = computeSpendingDelta(100, 100)
  assert(flat.direction === 'flat' && flat.percent === 0, 'Flat delta mismatch')
  console.log('  pass: computeSpendingDelta flat case')
  passed++

  assert(typeof getCategoryBreakdownWithDeltas === 'function', 'getCategoryBreakdownWithDeltas must be exported')
  console.log('  pass: getCategoryBreakdownWithDeltas exported')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
