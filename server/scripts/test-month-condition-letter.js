/*
 * Unit tests for month condition letter helpers.
 */

import {
  buildIncomeVsSpending,
  buildMonthConditionLetter,
  gradeMonthCondition,
} from '../utils/monthConditionLetter.js'
import {
  formatMonthKey,
  getCalendarMonthWindowForMonthKey,
  getPriorMonthKey,
} from '../utils/calendarMonth.js'
import { test } from 'node:test'

test('month condition letter', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('monthConditionLetter tests\n')

  const surplus = buildIncomeVsSpending({ income: 3000, spent: 2400 })
  assert(surplus.outcome === 'surplus', 'surplus')
  assert(surplus.net === 600, 'net 600')

  const deficit = buildIncomeVsSpending({ income: 2000, spent: 2500 })
  assert(deficit.outcome === 'deficit', 'deficit')

  const window = getCalendarMonthWindowForMonthKey('2026-05')
  assert(window.periodStart === '2026-05-01', `start ${window.periodStart}`)
  assert(window.endExclusiveIso === '2026-06-01', `end ${window.endExclusiveIso}`)
  assert(getPriorMonthKey('2026-05-01') === '2026-04', 'prior month')
  assert(formatMonthKey('2026-05-01') === '2026-05', 'month key')

  const letter = buildMonthConditionLetter({
    monthKey: '2026-05',
    monthLabel: 'May 2026',
    periodLabel: 'May 1–31',
    isCurrentMonth: false,
    isComplete: true,
    income: 3200,
    spent: 2800,
    netBalance: 900,
    topCategories: [
      { category: 'Food and Drink', amount: 420 },
      { category: 'Shopping', amount: 210 },
    ],
    recurringMonthly: 1400,
    priorIncome: 3100,
    priorSpent: 3000,
    dayOfMonth: 31,
  })

  assert(letter.condition.grade === 'stable' || letter.condition.grade === 'tight', `grade ${letter.condition.grade}`)
  assert(letter.drivers.length === 2, 'drivers')
  assert(letter.nextMonthPlan.length >= 2, 'plan moves')
  assert(letter.cashFlow.outcome === 'surplus', 'letter surplus')

  const atRisk = gradeMonthCondition({
    cashFlow: { outcome: 'deficit' },
    billsLoad: { fixedShareOfIncome: 70 },
    buffer: { posture: 'fragile' },
  })
  assert(atRisk.grade === 'at_risk', 'at risk grade')

  console.log('All monthConditionLetter tests passed.')
})
