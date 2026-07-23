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
 * The last `count` calendar month windows (oldest first), ending with the
 * current calendar month. Single source of truth for "last N months" charts
 * (Dashboard cash flow, Expense Analyzer category trend) so they can never
 * drift into disagreeing about which days belong to which month.
 *
 * monthLabel is year-qualified ("Jul '26") so a window spanning a year
 * boundary (Nov/Dec/Jan) is never ambiguous.
 */
export function getLastNCalendarMonthWindows(
  count,
  referenceDate = new Date(),
  timeZone = getAppTimezone()
) {
  const current = getCalendarMonthWindow(referenceDate, timeZone)
  const keys = [formatMonthKey(current.periodStart)]
  let cursorPeriodStart = current.periodStart

  for (let i = 1; i < count; i++) {
    const priorKey = getPriorMonthKey(cursorPeriodStart)
    keys.unshift(priorKey)
    cursorPeriodStart = `${priorKey}-01`
  }

  return keys.map((monthKey) => {
    const window = getCalendarMonthWindowForMonthKey(monthKey, timeZone)
    const [year] = monthKey.split('-')
    return {
      monthKey,
      periodStart: window.periodStart,
      endExclusiveIso: window.endExclusiveIso,
      monthLabel: `${window.monthLabel} '${year.slice(2)}`,
    }
  })
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

/**
 * Inclusive start + exclusive end civil dates for "today" in the app timezone.
 * Pass todayIso / tomorrowIso into SQL with AT TIME ZONE (see getAppTodaySqlParams).
 */
export function getAppDayBounds(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const { year, month, day } = getZonedDateParts(referenceDate, timeZone)
  const todayIso = formatIsoDateParts({ year, month, day })
  const nextUtc = new Date(Date.UTC(year, month - 1, day + 1))
  const tomorrowIso = formatIsoDateParts({
    year: nextUtc.getUTCFullYear(),
    month: nextUtc.getUTCMonth() + 1,
    day: nextUtc.getUTCDate(),
  })
  return { todayIso, tomorrowIso, timeZone }
}

/**
 * UTC Date for midnight (00:00:00) of a YYYY-MM-DD civil date in timeZone.
 * Binary-searches the UTC timeline so DST transitions stay correct.
 */
export function zonedMidnightToUtc(isoDate, timeZone = getAppTimezone()) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number)
  let lo = Date.UTC(year, month - 1, day - 1, 0, 0, 0)
  let hi = Date.UTC(year, month - 1, day + 2, 0, 0, 0)

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const asIso = formatIsoDateInAppTz(new Date(mid), timeZone)
    if (asIso < isoDate) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  return new Date(lo)
}

/**
 * Seconds until the next app-timezone midnight (for daily-limit retry hints).
 */
export function getSecondsUntilAppTomorrow(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const { tomorrowIso } = getAppDayBounds(referenceDate, timeZone)
  const nextMidnight = zonedMidnightToUtc(tomorrowIso, timeZone)
  return Math.max(1, Math.ceil((nextMidnight.getTime() - referenceDate.getTime()) / 1000))
}

/**
 * Params for “created_at falls on app-today” SQL filters.
 *
 *   created_at >= ($todayIso::timestamp AT TIME ZONE $timeZone)
 *   AND created_at < ($tomorrowIso::timestamp AT TIME ZONE $timeZone)
 */
export function getAppTodaySqlParams(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const { todayIso, tomorrowIso } = getAppDayBounds(referenceDate, timeZone)
  return { todayIso, tomorrowIso, timeZone }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole calendar days between two YYYY-MM-DD strings (UTC noon math — DST-safe).
 * Positive when laterIso is after earlierIso.
 */
export function daysBetweenIsoDates(laterIso, earlierIso) {
  const [y1, m1, d1] = String(laterIso).slice(0, 10).split('-').map(Number)
  const [y2, m2, d2] = String(earlierIso).slice(0, 10).split('-').map(Number)
  return Math.round(
    (Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / MS_PER_DAY
  )
}

/**
 * Add (or subtract) whole calendar days to a YYYY-MM-DD string.
 */
export function addCalendarDaysToIso(isoDate, deltaDays) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays))
  return formatIsoDateParts({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  })
}

function toIsoDateInput(dateInput) {
  if (typeof dateInput === 'string') {
    return dateInput.slice(0, 10)
  }
  return formatIsoDateInAppTz(dateInput instanceof Date ? dateInput : new Date(dateInput))
}

/** Length of the rolling "current" and "prior" comparison windows (civil days). */
export const ROLLING_COMPARISON_DAYS = 30

/**
 * Symmetric rolling windows in the app timezone (civil dates).
 *
 * Current: today and the previous 29 days → diff ∈ [0, 29] (30 days).
 * Prior: the 30 days before that → diff ∈ [30, 59].
 * Future-dated rows (diff < 0) are excluded from both.
 *
 * SQL: date >= currentStartIso AND date < tomorrowIso (current)
 *      date >= priorStartIso AND date < currentStartIso (prior)
 */
export function getRollingComparisonWindow(
  referenceDate = new Date(),
  timeZone = getAppTimezone()
) {
  const { todayIso, tomorrowIso } = getAppDayBounds(referenceDate, timeZone)
  const currentStartIso = addCalendarDaysToIso(
    todayIso,
    -(ROLLING_COMPARISON_DAYS - 1)
  )
  const priorStartIso = addCalendarDaysToIso(
    todayIso,
    -(ROLLING_COMPARISON_DAYS * 2 - 1)
  )

  return {
    todayIso,
    tomorrowIso,
    currentStartIso,
    priorStartIso,
    priorEndExclusiveIso: currentStartIso,
    timeZone,
    days: ROLLING_COMPARISON_DAYS,
  }
}

export function getRollingComparisonSqlParams(
  referenceDate = new Date(),
  timeZone = getAppTimezone()
) {
  return getRollingComparisonWindow(referenceDate, timeZone)
}

/**
 * True when dateInput falls in the current rolling window [today − (days−1), today].
 * For days=30 that is diff ∈ [0, 29] — not [0, 30] (which was a 31-day window).
 */
export function isWithinAppDaysAgo(dateInput, days, referenceDate = new Date()) {
  const todayIso = getAppTodayIso(referenceDate)
  const targetIso = toIsoDateInput(dateInput)
  const diff = daysBetweenIsoDates(todayIso, targetIso)
  return diff >= 0 && diff < days
}

/**
 * True when dateInput falls in the prior rolling window.
 * Default: diff ∈ [30, 60) for a 30-day prior period (symmetric with current).
 */
export function isWithinAppPriorPeriod(
  dateInput,
  recentDays = ROLLING_COMPARISON_DAYS,
  lookbackDays = ROLLING_COMPARISON_DAYS * 2,
  referenceDate = new Date()
) {
  const todayIso = getAppTodayIso(referenceDate)
  const targetIso = toIsoDateInput(dateInput)
  const diff = daysBetweenIsoDates(todayIso, targetIso)
  return diff >= recentDays && diff < lookbackDays
}
