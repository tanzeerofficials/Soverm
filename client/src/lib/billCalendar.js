/*
 * BILL CALENDAR HELPERS
 *
 * Groups forecast scheduledOutflows into calendar days for Overview
 * and the Forecast Quick Tool tab.
 */

import { formatForecastDate } from './cashFlowForecast.js'

export const BILL_CALENDAR_TEASER_DAYS = 14

function parseIsoDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`)
}

export function daysFromToday(isoDate, todayIso) {
  const start = parseIsoDate(todayIso)
  const end = parseIsoDate(isoDate)
  return Math.round((end - start) / (24 * 60 * 60 * 1000))
}

export function getLocalTodayIso(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0')
  const day = String(referenceDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Groups scheduled outflows by date within a day window.
 */
export function buildBillCalendarDays(
  scheduledOutflows = [],
  { todayIso = getLocalTodayIso(), withinDays = BILL_CALENDAR_TEASER_DAYS } = {}
) {
  const byDate = new Map()

  for (const event of scheduledOutflows) {
    if (!event?.date) {
      continue
    }

    const offset = daysFromToday(event.date, todayIso)
    if (offset < 0 || offset > withinDays) {
      continue
    }

    const existing = byDate.get(event.date) ?? {
      date: event.date,
      daysAway: offset,
      total: 0,
      events: [],
    }

    existing.events.push(event)
    existing.total += Number(event.amount) || 0
    byDate.set(event.date, existing)
  }

  return [...byDate.values()]
    .map((day) => ({
      ...day,
      total: Math.round(day.total * 100) / 100,
      label: formatForecastDate(day.date),
      relativeLabel:
        day.daysAway === 0 ? 'Today' : day.daysAway === 1 ? 'Tomorrow' : day.label,
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

export function summarizeBillCalendar(days) {
  const billCount = days.reduce((sum, day) => sum + day.events.length, 0)
  const totalAmount = days.reduce((sum, day) => sum + day.total, 0)
  return {
    billCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
    dayCount: days.length,
    nextDay: days[0] ?? null,
  }
}
