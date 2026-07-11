/**
 * Unit checks for app-timezone calendar month helpers.
 *
 * Usage: node scripts/test-calendar-month.js
 */

import {
  calendarMonthSqlBounds,
  formatIsoDateInAppTz,
  getCalendarMonthWindow,
  getCurrentProgressMonth,
  getZonedDateParts,
} from '../utils/calendarMonth.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const originalTz = process.env.APP_TIMEZONE
process.env.APP_TIMEZONE = 'America/New_York'

// Instant that is still June 30 in ET but already July 1 in UTC
const june30Et = new Date('2026-07-01T03:30:00.000Z')
const parts = getZonedDateParts(june30Et, 'America/New_York')
assert(parts.year === 2026 && parts.month === 6 && parts.day === 30, 'ET still June 30')
assert(getCurrentProgressMonth(june30Et) === '2026-06-01', 'progress month still June')
assert(formatIsoDateInAppTz(june30Et) === '2026-06-30', 'today ISO still June 30')

const window = getCalendarMonthWindow(june30Et)
assert(window.periodStart === '2026-06-01', 'periodStart June 1')
assert(window.periodEnd === '2026-06-30', 'periodEnd June 30')
assert(window.endExclusiveIso === '2026-07-01', 'exclusive end July 1')
assert(window.dayOfMonth === 30, 'dayOfMonth 30')

const bounds = calendarMonthSqlBounds(june30Et)
assert(bounds.startIso === '2026-06-01' && bounds.endExclusiveIso === '2026-07-01', 'SQL bounds')

// Mid-month sanity
const midJuly = new Date('2026-07-15T16:00:00.000Z')
assert(getCurrentProgressMonth(midJuly) === '2026-07-01', 'mid-July progress month')

if (originalTz === undefined) {
  delete process.env.APP_TIMEZONE
} else {
  process.env.APP_TIMEZONE = originalTz
}

console.log('test-calendar-month: ok')
