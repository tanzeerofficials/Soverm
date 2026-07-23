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
  isSignificantCategoryDelta,
} from '../utils/financialContext.js'
import { test } from 'node:test'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test('category breakdown deltas', () => {
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
      delta: spendingDelta
        ? {
            direction: spendingDelta.direction,
            percent: spendingDelta.percent,
            absoluteChange: spendingDelta.absoluteChange,
            isNewCategory: spendingDelta.isNewCategory === true,
          }
        : null,
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
  assert(subscriptions.delta?.isNewCategory === true, 'No prior spend → isNewCategory')
  assert(
    !isSignificantCategoryDelta(subscriptions.delta),
    'Sub-$50 new category is not a significant top mover'
  )
  console.log('  pass: small new category flagged but not significant')
  passed++

  assert(
    publicBreakdown[0].category === 'Food and Drink',
    `Biggest mover should be Food and Drink, got ${publicBreakdown[0].category}`
  )
  assert(
    publicBreakdown.at(-1).category === 'Subscriptions',
    'Sub-threshold new category should sort after percent movers'
  )
  console.log('  pass: sorted by absolute percent change descending')
  passed++

  const withLargeNew = buildCategoryBreakdownFromComparison({
    hasComparisonData: true,
    currentPeriod: {
      spending: {
        total: 1000,
        byCategory: {
          Dining: 120,
          Rent: 800,
        },
      },
      income: { total: 0 },
    },
    priorPeriod: {
      spending: {
        total: 100,
        byCategory: {
          Dining: 100,
        },
      },
      income: { total: 0 },
    },
  })

  assert(withLargeNew[0].category === 'Rent', 'Large new category sorts first')
  assert(withLargeNew[0].spendingDelta?.isNewCategory === true, 'Rent is new')
  assert(
    isSignificantCategoryDelta(withLargeNew[0].spendingDelta),
    'New $800 category is significant'
  )
  console.log('  pass: large new category can be top mover')
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
})
