/**
 * Unit tests for safe-to-spend calculation.
 * Run: node scripts/test-safe-to-spend.js
 */

import {
  computeSafeToSpend,
  getCalendarMonthWindow,
  roundCurrency,
} from '../utils/safeToSpend.js'
import { test } from 'node:test'

test('safe to spend', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('safeToSpend tests\n')

  assert(roundCurrency(10.556) === 10.56, 'rounds currency')

  const unconfigured = computeSafeToSpend({
    monthlyBudget: null,
    spentThisMonth: 500,
    netBalance: 2000,
  })
  assert(unconfigured.configured === false, 'not configured without budget')
  assert(unconfigured.safeToSpend === null, 'no safe-to-spend without budget')

  const healthy = computeSafeToSpend({
    monthlyBudget: 3000,
    spentThisMonth: 2158,
    netBalance: 4120,
  })
  assert(healthy.configured === true, 'configured with budget')
  assert(healthy.remainingBudget === 842, 'remaining budget')
  assert(healthy.safeToSpend === 842, 'safe-to-spend capped by remaining budget')
  assert(healthy.percentUsed === 72, 'percent used')

  const balanceLimited = computeSafeToSpend({
    monthlyBudget: 3000,
    spentThisMonth: 1000,
    netBalance: 400,
  })
  assert(balanceLimited.safeToSpend === 400, 'safe-to-spend capped by balance')

  const overBudget = computeSafeToSpend({
    monthlyBudget: 3000,
    spentThisMonth: 3120,
    netBalance: 500,
  })
  assert(overBudget.isOverBudget === true, 'detects over budget')
  assert(overBudget.overBudgetBy === 120, 'over budget amount')
  assert(overBudget.safeToSpend === 0, 'safe-to-spend zero when over budget')

  const withGoals = computeSafeToSpend({
    monthlyBudget: 3000,
    spentThisMonth: 2000,
    netBalance: 5000,
    plannedGoalsThisMonth: 500,
  })
  assert(withGoals.safeToSpend === 500, 'safe-to-spend subtracts planned goals')
  assert(withGoals.plannedGoalsThisMonth === 500, 'tracks planned goals total')

  const period = getCalendarMonthWindow(new Date('2026-03-15T12:00:00'))
  assert(period.periodStart === '2026-03-01', 'period start is first of month')
  assert(period.periodLabel.includes('Mar'), 'period label includes month')

  console.log('All safeToSpend tests passed.')
})
