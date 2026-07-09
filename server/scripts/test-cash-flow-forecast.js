/**
 * Unit tests for cash flow forecast projection logic.
 *
 * Usage: node scripts/test-cash-flow-forecast.js
 */

import {
  buildCashFlowForecast,
  buildScheduledOutflows,
  expandRecurringOccurrences,
  summarizeForecastRisk,
} from '../utils/cashFlowForecast.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('cashFlowForecast tests\n')

const referenceDate = new Date(2026, 6, 9) // Jul 9, 2026

const monthlyCharge = {
  merchant: 'Netflix',
  averageAmount: 15.99,
  monthlyEquivalent: 15.99,
  cadence: 'monthly',
  lastChargedDate: '2026-06-09',
  nextExpectedDate: '2026-07-09',
}

const occurrences = expandRecurringOccurrences(monthlyCharge, {
  startDate: '2026-07-10',
  endDate: '2026-08-09',
})
assert(occurrences.length >= 1, 'monthly charge should schedule inside window')
assert(occurrences[0].date === '2026-08-09', 'monthly charge advances to next month')

const scheduled = buildScheduledOutflows([monthlyCharge], {
  startDate: '2026-07-10',
  endDate: '2026-08-09',
})
assert(scheduled.length >= 1, 'scheduled outflows should include recurring charge')

const forecast = buildCashFlowForecast({
  startingBalance: 3000,
  incomeLast30Days: 6000,
  spendingLast30Days: 4500,
  confirmedRecurringMonthly: 300,
  recurringCharges: [monthlyCharge],
  referenceDate,
})

assert(forecast.startingBalance === 3000, 'starting balance preserved')
assert(forecast.points.length === 31, 'includes today plus 30 days')
assert(forecast.assumptions.dailyIncome === 200, 'daily income from 30-day average')
assert(forecast.assumptions.dailyDiscretionary === 140, 'discretionary spend excludes recurring')
assert(forecast.endingBalance > forecast.startingBalance, 'surplus income raises projected balance')
assert(forecast.lowestBalance <= forecast.endingBalance, 'lowest balance tracked')

const shortfall = buildCashFlowForecast({
  startingBalance: 400,
  incomeLast30Days: 1000,
  spendingLast30Days: 5000,
  confirmedRecurringMonthly: 0,
  recurringCharges: [],
  referenceDate,
})
const risk = summarizeForecastRisk(shortfall)
assert(risk.tone === 'danger' || risk.tone === 'warning', 'tight cash flow surfaces warning')

console.log('All cashFlowForecast tests passed.')
