/*
 * PAYDAY / RUNWAY COACH (pure helpers)
 *
 * Answers: Will I make it to payday? At this week's pace, what's left?
 */

import { roundCurrency } from './safeToSpend.js'
import { buildScheduledOutflows } from './cashFlowForecast.js'
import { addDaysToIso } from './calendarWeek.js'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

/**
 * Bill calendar windows (14 and 30 days) from recurring charges.
 */
export function buildBillCalendarWindows(
  recurringCharges = [],
  { todayIso, withinDaysList = [14, 30] } = {}
) {
  if (!todayIso) {
    return { days14: [], days30: [], summary14: null, summary30: null }
  }

  const result = {}
  for (const days of withinDaysList) {
    const endIso = addDaysToIso(todayIso, days)
    const events = buildScheduledOutflows(recurringCharges, {
      startDate: todayIso,
      endDate: endIso,
    }).map((event) => ({
      date: event.date,
      amount: roundCurrency(event.amount),
      merchant: event.merchant,
      cadence: event.cadence,
    }))
    const total = roundCurrency(events.reduce((sum, e) => sum + e.amount, 0))
    result[`days${days}`] = events
    result[`summary${days}`] = {
      withinDays: days,
      billCount: events.length,
      totalAmount: total,
      nextBill: events[0] ?? null,
    }
  }

  return {
    days14: result.days14 ?? [],
    days30: result.days30 ?? [],
    summary14: result.summary14 ?? null,
    summary30: result.summary30 ?? null,
  }
}

/**
 * Pace + Fine/Tight/At risk verdict until payday.
 */
export function buildPaydayRunwayCoach({
  whatsLeft = null,
  spentThisWeek = 0,
  weekStartIso = null,
  todayIso = null,
  billWindows = null,
} = {}) {
  if (!whatsLeft?.configured) {
    return {
      configured: false,
      verdict: null,
      title: 'Confirm payday to unlock your runway coach',
      detail:
        'Once we know your next payday, we’ll tell you if you’re fine, tight, or at risk — and what this week’s spend pace implies.',
      pace: null,
      bills: billWindows
        ? {
            next14: billWindows.summary14,
            next30: billWindows.summary30,
            upcoming: (billWindows.days14 ?? []).slice(0, 5),
          }
        : null,
    }
  }

  const daysUntil = Math.max(0, Number(whatsLeft.daysUntilPayday) || 0)
  const remaining = roundCurrency(whatsLeft.amount ?? 0)
  const billsTotal = roundCurrency(whatsLeft.billsUntilPaydayTotal ?? 0)

  let daysElapsedThisWeek = 1
  if (weekStartIso && todayIso) {
    const ms =
      new Date(`${todayIso}T12:00:00`).getTime() -
      new Date(`${weekStartIso}T12:00:00`).getTime()
    daysElapsedThisWeek = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1)
  }

  const weeklySpend = roundCurrency(spentThisWeek)
  const dailySpendRate = roundCurrency(weeklySpend / daysElapsedThisWeek)
  const projectedSpendUntilPayday = roundCurrency(dailySpendRate * Math.max(daysUntil, 0))
  const projectedLeftAtPayday = roundCurrency(
    Math.max(0, remaining - projectedSpendUntilPayday)
  )
  const shortfall = roundCurrency(
    Math.max(0, projectedSpendUntilPayday - remaining)
  )

  let verdict = 'fine'
  let title = 'You’re on track to payday'
  let detail = `About ${formatMoney(remaining)} left after known bills${
    daysUntil === 0 ? ' (payday is today)' : ` with ${daysUntil} day${daysUntil === 1 ? '' : 's'} to go`
  }.`

  if (remaining <= 0 && billsTotal > 0) {
    verdict = 'at_risk'
    title = 'Plan carefully until payday'
    detail = `Known bills (${formatMoney(billsTotal)}) already use up your free balance. Focus on essentials until you get paid.`
  } else if (shortfall > 0 && daysUntil > 0) {
    verdict = 'at_risk'
    title = 'This week’s pace may run tight'
    detail = `Spending ~${formatMoney(dailySpendRate)}/day projects ${formatMoney(projectedSpendUntilPayday)} before payday — about ${formatMoney(shortfall)} more than you have free. A small cut now helps.`
  } else if (
    (daysUntil > 0 && remaining / daysUntil < 25) ||
    projectedLeftAtPayday < 50 ||
    (daysUntil <= 3 && remaining < 75)
  ) {
    verdict = 'tight'
    title = 'Tight until payday'
    detail = `At ~${formatMoney(dailySpendRate)}/day this week, you’d have about ${formatMoney(projectedLeftAtPayday)} left by payday. Keep discretionary spend low.`
  } else if (daysUntil > 0) {
    detail = `At this week’s pace (~${formatMoney(dailySpendRate)}/day), you’d still have about ${formatMoney(projectedLeftAtPayday)} by payday.`
  }

  const pace = {
    spentThisWeek: weeklySpend,
    daysElapsedThisWeek,
    dailySpendRate,
    daysUntilPayday: daysUntil,
    projectedSpendUntilPayday,
    projectedLeftAtPayday,
    shortfall,
    summary:
      daysUntil === 0
        ? `Payday is today. Free after bills: ${formatMoney(remaining)}.`
        : `At ${formatMoney(dailySpendRate)}/day, projected left by payday: ${formatMoney(projectedLeftAtPayday)}${
            shortfall > 0 ? ` (short by ${formatMoney(shortfall)})` : ''
          }.`,
  }

  return {
    configured: true,
    verdict,
    title,
    detail,
    pace,
    bills: billWindows
      ? {
          next14: billWindows.summary14,
          next30: billWindows.summary30,
          upcoming: (billWindows.days14 ?? []).slice(0, 6),
          untilPayday: whatsLeft.bills ?? [],
        }
      : {
          untilPayday: whatsLeft.bills ?? [],
          upcoming: [],
          next14: null,
          next30: null,
        },
  }
}
