/*
 * Unit tests for payday runway coach.
 */

import {
  buildBillCalendarWindows,
  buildPaydayRunwayCoach,
} from '../utils/paydayRunwayCoach.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('paydayRunwayCoach tests\n')

const unconfigured = buildPaydayRunwayCoach({
  whatsLeft: { configured: false },
  spentThisWeek: 100,
})
assert(unconfigured.configured === false, 'unconfigured coach')
assert(unconfigured.verdict === null, 'no verdict without payday')

const fine = buildPaydayRunwayCoach({
  whatsLeft: {
    configured: true,
    amount: 400,
    daysUntilPayday: 10,
    billsUntilPaydayTotal: 50,
    bills: [],
  },
  spentThisWeek: 70,
  weekStartIso: '2026-05-11',
  todayIso: '2026-05-13',
})
assert(fine.verdict === 'fine', `expected fine, got ${fine.verdict}`)
assert(fine.pace.dailySpendRate > 0, 'daily rate')

const atRisk = buildPaydayRunwayCoach({
  whatsLeft: {
    configured: true,
    amount: 40,
    daysUntilPayday: 7,
    billsUntilPaydayTotal: 200,
    bills: [{ merchant: 'Rent', amount: 200, date: '2026-05-15' }],
  },
  spentThisWeek: 210,
  weekStartIso: '2026-05-11',
  todayIso: '2026-05-14',
})
assert(atRisk.verdict === 'at_risk', `expected at_risk, got ${atRisk.verdict}`)
assert(atRisk.pace.shortfall > 0, 'shortfall when pace exceeds remaining')

const windows = buildBillCalendarWindows(
  [
    {
      merchant: 'Netflix',
      averageAmount: 15,
      cadence: 'monthly',
      nextExpectedDate: '2026-05-20',
    },
  ],
  { todayIso: '2026-05-10' }
)
assert(windows.summary14.billCount === 1, '14-day bill count')
assert(windows.summary30.totalAmount === 15, '30-day total')

console.log('All paydayRunwayCoach tests passed.')
