/*
 * CALENDAR WEEK (APP TIMEZONE)
 *
 * Monday–Sunday week windows in APP_TIMEZONE for Weekly Review.
 */

import {
  formatIsoDateInAppTz,
  formatIsoDateParts,
  getAppTimezone,
  getZonedDateParts,
} from './calendarMonth.js'

const WEEKDAY_TO_MONDAY_OFFSET = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

function parseIsoDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

function addDaysToIso(iso, days, timeZone = getAppTimezone()) {
  const next = parseIsoDate(iso)
  next.setDate(next.getDate() + days)
  return formatIsoDateInAppTz(next, timeZone)
}

function weekdayShortInTz(referenceDate, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(referenceDate)
}

/**
 * Current Mon–Sun week in app timezone.
 * Returns inclusive start/end ISO dates + exclusive end for SQL.
 */
export function getCalendarWeekWindow(referenceDate = new Date(), timeZone = getAppTimezone()) {
  const todayIso = formatIsoDateInAppTz(referenceDate, timeZone)
  const weekday = weekdayShortInTz(referenceDate, timeZone)
  const offsetFromMonday = WEEKDAY_TO_MONDAY_OFFSET[weekday] ?? 0

  const weekStartIso = addDaysToIso(todayIso, -offsetFromMonday, timeZone)
  const weekEndIso = addDaysToIso(weekStartIso, 6, timeZone)
  const endExclusiveIso = addDaysToIso(weekStartIso, 7, timeZone)
  const priorWeekStartIso = addDaysToIso(weekStartIso, -7, timeZone)
  const priorWeekEndExclusiveIso = weekStartIso

  const startParts = getZonedDateParts(parseIsoDate(weekStartIso), timeZone)
  const endParts = getZonedDateParts(parseIsoDate(weekEndIso), timeZone)
  const startLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day)))
  const endLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day)))

  return {
    weekStartIso,
    weekEndIso,
    endExclusiveIso,
    priorWeekStartIso,
    priorWeekEndExclusiveIso,
    todayIso,
    label: `${startLabel} – ${endLabel}`,
    timeZone,
  }
}

export { addDaysToIso, formatIsoDateParts }
