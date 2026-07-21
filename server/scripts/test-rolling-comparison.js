/**
 * Rolling comparison window + refund netting + coverage gate tests.
 *
 * Usage: node --test scripts/test-rolling-comparison.js
 */

import { test } from 'node:test'

import {
  addCalendarDaysToIso,
  getAppTodayIso,
  getRollingComparisonWindow,
  isWithinAppDaysAgo,
  isWithinAppPriorPeriod,
  ROLLING_COMPARISON_DAYS,
} from '../utils/calendarMonth.js'
import {
  buildComparisonFromTransactions,
  evaluateHasComparisonData,
  MIN_COMPARISON_HISTORY_DAYS,
  netSameMerchantRefunds,
} from '../utils/rollingComparison.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

test("rolling comparison windows + refunds + coverage", () => {
  const originalTz = process.env.APP_TIMEZONE
  process.env.APP_TIMEZONE = 'America/New_York'

  const reference = new Date('2026-07-15T16:00:00.000Z')
  const todayIso = getAppTodayIso(reference)
  assert(todayIso === '2026-07-15', 'fixture today')

  assert(isWithinAppDaysAgo(todayIso, 30, reference), 'today in current')
  assert(isWithinAppDaysAgo(addCalendarDaysToIso(todayIso, -29), 30, reference), 'day 29 in current')
  assert(
    !isWithinAppDaysAgo(addCalendarDaysToIso(todayIso, -30), 30, reference),
    'day 30 is prior, not current (symmetric 30-day windows)'
  )
  assert(
    isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -30), 30, 60, reference),
    'day 30 starts prior'
  )
  assert(
    isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -59), 30, 60, reference),
    'day 59 still prior'
  )
  assert(
    !isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -60), 30, 60, reference),
    'day 60 outside prior'
  )
  assert(!isWithinAppDaysAgo(addCalendarDaysToIso(todayIso, 1), 30, reference), 'future excluded')

  const window = getRollingComparisonWindow(reference)
  assert(window.currentStartIso === addCalendarDaysToIso(todayIso, -29), 'current start')
  assert(window.priorStartIso === addCalendarDaysToIso(todayIso, -59), 'prior start')
  assert(window.priorEndExclusiveIso === window.currentStartIso, 'windows abut')
  assert(window.days === ROLLING_COMPARISON_DAYS, 'window length')

  const spend = [{ name: 'Amazon', amount: 500, category: 'Shops', date: todayIso, pending: false }]
  const refund = [{ name: 'Amazon', amount: -500, category: 'Shops', date: todayIso, pending: false }]
  const netted = netSameMerchantRefunds(spend, refund)
  assert(netted.spendingRows.length === 2, 'refund moved into spending')
  assert(netted.incomeRows.length === 0, 'refund removed from income')
  assert(
    netted.spendingRows.reduce((sum, row) => sum + Number(row.amount), 0) === 0,
    'same-merchant refund nets to zero spend'
  )

  const payroll = [{ name: 'ACME PAYROLL', amount: -2000, category: 'Income', date: todayIso, pending: false }]
  const payrollNetted = netSameMerchantRefunds(spend, payroll)
  assert(payrollNetted.incomeRows.length === 1, 'payroll stays income even if merchant overlaps oddly')

  // Short history: earliest only 40 days ago → no comparison
  const shortHistory = []
  for (let daysAgo = 0; daysAgo <= 40; daysAgo += 1) {
    shortHistory.push({
      name: 'Coffee',
      amount: 5,
      category: 'Food and Drink',
      date: addCalendarDaysToIso(todayIso, -daysAgo),
      pending: false,
    })
  }
  assert(
    evaluateHasComparisonData(shortHistory, reference) === false,
    `history < ${MIN_COMPARISON_HISTORY_DAYS} days must not emit deltas`
  )
  const shortComparison = buildComparisonFromTransactions(shortHistory, reference)
  assert(shortComparison.hasComparisonData === false, '40-day fixture has no comparison data')
  assert(
    shortComparison.currentPeriod.spending.total > 0,
    '40-day fixture still has current spend (just no prior claim)'
  )

  // Deep history with thin prior window still needs MIN_PRIOR_WINDOW_TXNS
  const deepButThin = []
  for (let daysAgo = 0; daysAgo <= 70; daysAgo += 1) {
    if (daysAgo >= 30 && daysAgo <= 32) {
      deepButThin.push({
        name: 'Coffee',
        amount: 5,
        category: 'Food and Drink',
        date: addCalendarDaysToIso(todayIso, -daysAgo),
        pending: false,
      })
    } else if (daysAgo < 30 || daysAgo > 55) {
      deepButThin.push({
        name: 'Coffee',
        amount: 5,
        category: 'Food and Drink',
        date: addCalendarDaysToIso(todayIso, -daysAgo),
        pending: false,
      })
    }
  }
  // prior has days 30-32 = 3 txns — should pass
  assert(evaluateHasComparisonData(deepButThin, reference) === true, 'deep history + 3 prior txns ok')

  const comparison = buildComparisonFromTransactions(
    [
      ...spend,
      ...refund,
      { name: 'Coffee', amount: 4, category: 'Food and Drink', date: addCalendarDaysToIso(todayIso, -35), pending: false },
      { name: 'Coffee', amount: 4, category: 'Food and Drink', date: addCalendarDaysToIso(todayIso, -40), pending: false },
      { name: 'Coffee', amount: 4, category: 'Food and Drink', date: addCalendarDaysToIso(todayIso, -45), pending: false },
      { name: 'Coffee', amount: 4, category: 'Food and Drink', date: addCalendarDaysToIso(todayIso, -56), pending: false },
    ],
    reference
  )
  assert(comparison.currentPeriod.spending.total === 0, 'comparison nets refund in current spend')
  assert(comparison.currentPeriod.income.total === 0, 'refunded Amazon not counted as income')

  if (originalTz === undefined) {
    delete process.env.APP_TIMEZONE
  } else {
    process.env.APP_TIMEZONE = originalTz
  }

})
