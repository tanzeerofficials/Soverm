/**
 * Unit tests for cash flow forecast projection logic.
 *
 * Usage: node scripts/test-cash-flow-forecast.js
 */

import {
  buildCashFlowForecast,
  buildScheduledOutflows,
  expandRecurringOccurrences,
  resolveDiscretionaryMonthly,
  resolveRunwayDays,
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

const occurrencesToday = expandRecurringOccurrences(monthlyCharge, {
  startDate: '2026-07-09',
  endDate: '2026-08-09',
})
assert(occurrencesToday.length >= 1, 'monthly charge should schedule inside window')
assert(occurrencesToday[0].date === '2026-07-09', 'charge due today is included')

const scheduled = buildScheduledOutflows([monthlyCharge], {
  startDate: '2026-07-09',
  endDate: '2026-08-09',
})
assert(scheduled.length >= 1, 'scheduled outflows should include recurring charge')
assert(scheduled[0].date === '2026-07-09', 'scheduled list includes today')

assert(
  resolveDiscretionaryMonthly(4500, 300) === 4200,
  'discretionary = spend - recurring when recurring is smaller'
)
assert(
  resolveDiscretionaryMonthly(200, 500) === 10,
  'discretionary floor keeps ~5% of spend when recurring exceeds spend'
)

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
assert(forecast.points[0].recurringSpend === 15.99, 'today recurring applied to today point')
assert(forecast.assumptions.dailyIncome === 200, 'daily income from 30-day average')
assert(forecast.assumptions.dailyDiscretionary === 140, 'discretionary spend excludes recurring')
assert(forecast.hasBaselineData === true, 'baseline flag true with history')
assert(forecast.lowestBalance <= forecast.endingBalance, 'lowest balance tracked')

const empty = buildCashFlowForecast({
  startingBalance: 1000,
  incomeLast30Days: 0,
  spendingLast30Days: 0,
  confirmedRecurringMonthly: 0,
  recurringCharges: [],
  referenceDate,
})
assert(empty.hasBaselineData === false, 'no history → no baseline')
assert(summarizeForecastRisk(empty).title.includes('Not enough'), 'empty history softens risk copy')

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
assert(risk.lowestBalanceDate, 'risk includes structured date field')

const runwayFromPoints = resolveRunwayDays(
  [
    { balance: 100 },
    { balance: 50 },
    { balance: 0 },
    { balance: -10 },
  ],
  100,
  50
)
assert(runwayFromPoints === 2, 'runway uses first non-positive simulated day')

console.log('All cashFlowForecast tests passed.')
