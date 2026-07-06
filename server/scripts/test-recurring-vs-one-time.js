/*
 * Verifies recurring vs one-time split in category and overall totals.
 *
 * Usage: node scripts/test-recurring-vs-one-time.js
 */

import 'dotenv/config'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
} from '../utils/expenseAnalyzerData.js'
import { computeRecurringVsOneTimeSplit } from '../utils/recurringVsOneTime.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, daysAgo, category = 'Subscriptions') {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)

  return {
    name,
    amount,
    date: date.toISOString().slice(0, 10),
    category,
    pending: false,
  }
}

let passed = 0

try {
  console.log('Recurring vs one-time split tests\n')

  const transactions = [
    tx('SPOTIFY', 10.99, 5, 'Subscriptions'),
    tx('SPOTIFY', 10.99, 35, 'Subscriptions'),
    tx('SPOTIFY', 10.99, 65, 'Subscriptions'),
    tx('Chipotle', 18.5, 3, 'Food and Drink'),
    tx('Chipotle', 22.0, 12, 'Food and Drink'),
    tx('Whole Foods', 64.2, 8, 'Food and Drink'),
  ]

  const comparison = buildComparisonFromTransactions(transactions)
  const payload = buildExpenseAnalyzerPayload(comparison, transactions)

  const food = payload.categoryBreakdown.find((entry) => entry.category === 'Food and Drink')
  const subs = payload.categoryBreakdown.find((entry) => entry.category === 'Subscriptions')

  assert(food?.oneTimeTotal === 104.7, `Food one-time should be 104.7, got ${food?.oneTimeTotal}`)
  assert(food?.recurringMonthly === 0, 'Food should have no recurring monthly burn')
  console.log('  pass: one-time-only category totals')
  passed++

  assert((subs?.recurringMonthly ?? 0) > 0, 'Subscriptions should include recurring monthly burn')
  assert(subs?.oneTimeTotal === 0, 'Subscriptions should have no one-time spend in period')
  console.log('  pass: recurring-only category totals')
  passed++

  assert(
    payload.overallSpending.recurringMonthly === payload.totalRecurringMonthly,
    'Overall recurring monthly should match totalRecurringMonthly'
  )
  assert(payload.overallSpending.oneTimeTotal === 104.7, 'Overall one-time should match discretionary spend')
  console.log('  pass: overall recurring vs one-time totals')
  passed++

  const heuristicOnly = computeRecurringVsOneTimeSplit(transactions, [])
  assert(heuristicOnly.totalOneTime === 115.69, 'Without recurring charges, all spend is one-time')
  console.log('  pass: empty recurring list treats all spend as one-time')
  passed++

  console.log(`\n${passed}/${passed} recurring vs one-time tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
