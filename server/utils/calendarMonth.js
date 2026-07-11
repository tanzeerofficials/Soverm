/*
 * CALENDAR MONTH (APP TIMEZONE)
 *
 * What this does:
 * - Answers "what is today?" and "what is the current calendar month?"
 *   in one fixed timezone (default America/New_York)
 * - Returns ISO dates we can pass into SQL as parameters
 *
 * Why we need it:
 * - Before this, Postgres used CURRENT_DATE (usually UTC on Railway) while
 *   Node used new Date() local getters. Near month boundaries those could
 *   disagree — spending totals and savings resets for the "wrong" month.
 *
 * Bigger picture:
 * - Trackers, safe-to-spend, savings detection, and cap alert dedup keys all
 *   share this helper so "July spending" means the same thing everywhere.
 *
 * Concept: timezones. A single instant (UTC midnight) can still be June 30
 * in New York. We use Intl.DateTimeFormat with timeZone — no extra package.
 */

export const DEFAULT_APP_TIMEZONE = 'America/New_York'

export function getAppTimezone() {
  return process.env.APP_TIMEZONE || DEFAULT_APP_TIMEZONE
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

/**
 * Calendar Y/M/D parts for an instant in the app timezone.
 */
export function getZonedDateParts(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate)

  const lookup = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  }
}

export function formatIsoDateParts({ year, month, day }) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Formats a Date as YYYY-MM-DD in the app timezone (not the host local TZ).
 */
export function formatIsoDateInAppTz(date = new Date(), timeZone = getAppTimezone()) {
  return formatIsoDateParts(getZonedDateParts(date, timeZone))
}

export function getAppTodayIso(referenceDate = new Date(), timeZone = getAppTimezone()) {
  return formatIsoDateInAppTz(referenceDate, timeZone)
}

/**
 * First day of the current calendar month in the app timezone (YYYY-MM-DD).
 */
export function getCurrentProgressMonth(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const { year, month } = getZonedDateParts(referenceDate, timeZone)
  return formatIsoDateParts({ year, month, day: 1 })
}

/**
 * Days in a calendar month (month is 1–12).
 */
export function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Inclusive start + exclusive end dates for the current calendar month,
 * plus UI labels. Use startIso / endExclusiveIso in SQL ($n::date params).
 */
export function getCalendarMonthWindow(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const { year, month, day } = getZonedDateParts(referenceDate, timeZone)
  const lastDayOfMonth = daysInCalendarMonth(year, month)
  const periodStart = formatIsoDateParts({ year, month, day: 1 })
  const periodEnd = formatIsoDateParts({ year, month, day: lastDayOfMonth })
  const endExclusiveYear = month === 12 ? year + 1 : year
  const endExclusiveMonth = month === 12 ? 1 : month + 1
  const endExclusiveIso = formatIsoDateParts({
    year: endExclusiveYear,
    month: endExclusiveMonth,
    day: 1,
  })

  const labelDate = new Date(Date.UTC(year, month - 1, 1))
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(labelDate)

  const isLastDay = day === lastDayOfMonth
  const periodLabel = isLastDay
    ? `${monthLabel} 1–${lastDayOfMonth}`
    : `${monthLabel} 1–today`

  return {
    periodStart,
    periodEnd,
    endExclusiveIso,
    daysLeftInMonth: Math.max(0, lastDayOfMonth - day),
    dayOfMonth: day,
    periodLabel,
    monthLabel,
    timeZone,
  }
}

/**
 * Calendar month window for a YYYY-MM or YYYY-MM-01 key (day 1 of that month).
 */
export function getCalendarMonthWindowForMonthKey(monthKey, timeZone = getAppTimezone()) {
  const match = String(monthKey ?? '').match(/^(\d{4})-(\d{2})/)
  if (!match) {
    return getCalendarMonthWindow(new Date(), timeZone)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  // Mid-month noon UTC avoids DST edge weirdness for labeling
  const reference = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0))
  return getCalendarMonthWindow(reference, timeZone)
}

/**
 * Previous calendar month key (YYYY-MM) relative to a window's periodStart.
 */
export function getPriorMonthKey(periodStartIso) {
  const [year, month] = String(periodStartIso).split('-').map(Number)
  const priorMonth = month === 1 ? 12 : month - 1
  const priorYear = month === 1 ? year - 1 : year
  return `${priorYear}-${String(priorMonth).padStart(2, '0')}`
}

export function formatMonthKey(periodStartIso) {
  return String(periodStartIso).slice(0, 7)
}

/**
 * Convenience: { startIso, endExclusiveIso } for parameterized SQL filters.
 */
export function calendarMonthSqlBounds(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const window = getCalendarMonthWindow(referenceDate, timeZone)
  return {
    startIso: window.periodStart,
    endExclusiveIso: window.endExclusiveIso,
  }
}
