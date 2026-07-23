/**
 * Unit checks for app-timezone calendar month helpers.
 *
 * Usage: node scripts/test-calendar-month.js
 */

import {
  addCalendarDaysToIso,
  calendarMonthSqlBounds,
  formatIsoDateInAppTz,
  getAppDayBounds,
  getAppTodaySqlParams,
  getCalendarMonthWindow,
  getCurrentProgressMonth,
  getRollingComparisonWindow,
  getSecondsUntilAppTomorrow,
  getZonedDateParts,
  isWithinAppDaysAgo,
  isWithinAppPriorPeriod,
  zonedMidnightToUtc,
} from '../utils/calendarMonth.js'
import { test } from 'node:test'

test('calendar month', () => {
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

  const dayBounds = getAppDayBounds(june30Et)
  assert(dayBounds.todayIso === '2026-06-30', 'app day today is June 30 ET')
  assert(dayBounds.tomorrowIso === '2026-07-01', 'app day tomorrow is July 1')

  const sqlParams = getAppTodaySqlParams(june30Et)
  assert(sqlParams.todayIso === '2026-06-30', 'SQL today param')
  assert(sqlParams.tomorrowIso === '2026-07-01', 'SQL tomorrow param')
  assert(sqlParams.timeZone === 'America/New_York', 'SQL timezone param')

  const midnightEt = zonedMidnightToUtc('2026-07-01', 'America/New_York')
  assert(formatIsoDateInAppTz(midnightEt, 'America/New_York') === '2026-07-01', 'midnight lands on July 1 ET')
  assert(
    formatIsoDateInAppTz(new Date(midnightEt.getTime() - 1000), 'America/New_York') === '2026-06-30',
    'one second before is still June 30 ET'
  )

  const seconds = getSecondsUntilAppTomorrow(june30Et)
  assert(seconds > 0 && seconds < 24 * 60 * 60, 'seconds until ET tomorrow is within a day')

  const mid = new Date('2026-07-15T16:00:00.000Z')
  const today = formatIsoDateInAppTz(mid)
  assert(isWithinAppDaysAgo(addCalendarDaysToIso(today, -29), 30, mid), 'current includes day 29')
  assert(!isWithinAppDaysAgo(addCalendarDaysToIso(today, -30), 30, mid), 'current excludes day 30')
  assert(isWithinAppPriorPeriod(addCalendarDaysToIso(today, -30), 30, 60, mid), 'prior starts day 30')
  const roll = getRollingComparisonWindow(mid)
  assert(roll.currentStartIso === addCalendarDaysToIso(today, -29), 'rolling current start')
  assert(roll.priorStartIso === addCalendarDaysToIso(today, -59), 'rolling prior start')

  if (originalTz === undefined) {
    delete process.env.APP_TIMEZONE
  } else {
    process.env.APP_TIMEZONE = originalTz
  }

  console.log('test-calendar-month: ok')
})
