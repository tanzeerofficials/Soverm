/**
 * Unit checks for bill calendar grouping.
 * Run: node scripts/test-bill-calendar.js
 */

import {
  buildBillCalendarDays,
  summarizeBillCalendar,
} from '../src/lib/billCalendar.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const days = buildBillCalendarDays(
  [
    { date: '2026-07-10', merchant: 'Netflix', amount: 15.99, cadence: 'monthly' },
    { date: '2026-07-10', merchant: 'Spotify', amount: 10.99, cadence: 'monthly' },
    { date: '2026-07-20', merchant: 'Rent', amount: 1800, cadence: 'monthly' },
    { date: '2026-08-01', merchant: 'Gym', amount: 40, cadence: 'monthly' },
  ],
  { todayIso: '2026-07-09', withinDays: 14 }
)

assert(days.length === 2, 'only bills within 14 days')
assert(days[0].date === '2026-07-10', 'first day July 10')
assert(days[0].events.length === 2, 'two bills on July 10')
assert(Math.abs(days[0].total - 26.98) < 0.001, 'day total')
assert(days[0].relativeLabel === 'Tomorrow', 'tomorrow label')

const summary = summarizeBillCalendar(days)
assert(summary.billCount === 3, 'three bills total')
assert(Math.abs(summary.totalAmount - 1826.98) < 0.001, 'summary total')

console.log('test-bill-calendar: ok')
