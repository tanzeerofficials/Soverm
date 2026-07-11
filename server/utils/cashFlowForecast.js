/*
 * CASH FLOW FORECAST
 *
 * Projects net balance over the next N days using:
 * - Current connected-account balance (starting point)
 * - Confirmed recurring outflows on their expected dates (including today)
 * - Average daily income from the last 30 days
 * - Average daily discretionary spend (30-day spend minus recurring)
 *
 * This is a deterministic estimate — not AI — so users can sanity-check it.
 */

import { roundCurrency, formatIsoDate } from './safeToSpend.js'

export const FORECAST_HORIZON_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseIsoDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

function addDaysToIso(iso, days) {
  const next = parseIsoDate(iso)
  next.setDate(next.getDate() + days)
  return formatIsoDate(next)
}

function advanceRecurringDate(iso, cadence) {
  const next = parseIsoDate(iso)

  switch (cadence) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    case 'annual':
      next.setFullYear(next.getFullYear() + 1)
      break
    default:
      next.setDate(next.getDate() + 30)
      break
  }

  return formatIsoDate(next)
}

function initialRecurringDate(charge) {
  if (charge.nextExpectedDate) {
    return charge.nextExpectedDate
  }

  if (charge.lastChargedDate) {
    return advanceRecurringDate(charge.lastChargedDate, charge.cadence ?? 'monthly')
  }

  return null
}

/**
 * Lists dated outflows for one recurring charge inside the forecast window.
 */
export function expandRecurringOccurrences(charge, { startDate, endDate, maxOccurrences = 8 } = {}) {
  const anchor = initialRecurringDate(charge)
  if (!anchor) {
    return []
  }

  const amount = roundCurrency(charge.averageAmount ?? charge.monthlyEquivalent ?? 0)
  if (amount <= 0) {
    return []
  }

  const windowStart = parseIsoDate(startDate)
  const windowEnd = parseIsoDate(endDate)
  const occurrences = []
  let cursor = anchor

  // Fast-forward stale expected dates to the first occurrence on/after the window start.
  let guard = 0
  while (parseIsoDate(cursor) < windowStart && guard < 24) {
    cursor = advanceRecurringDate(cursor, charge.cadence ?? 'monthly')
    guard += 1
  }

  guard = 0
  while (parseIsoDate(cursor) <= windowEnd && guard < maxOccurrences) {
    occurrences.push({
      date: cursor,
      amount,
      merchant: charge.merchant,
      cadence: charge.cadence ?? 'monthly',
      type: 'recurring',
    })
    cursor = advanceRecurringDate(cursor, charge.cadence ?? 'monthly')
    guard += 1
  }

  return occurrences
}

export function buildScheduledOutflows(recurringCharges = [], { startDate, endDate } = {}) {
  const events = []

  for (const charge of recurringCharges) {
    events.push(
      ...expandRecurringOccurrences(charge, {
        startDate,
        endDate,
      })
    )
  }

  return events.sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date)
    if (dateCompare !== 0) {
      return dateCompare
    }

    return left.merchant.localeCompare(right.merchant)
  })
}

function indexEventsByDate(events) {
  const byDate = new Map()

  for (const event of events) {
    const bucket = byDate.get(event.date) ?? []
    bucket.push(event)
    byDate.set(event.date, bucket)
  }

  return byDate
}

/**
 * Discretionary monthly burn = recent spend minus confirmed recurring.
 * Cap the recurring subtraction so we never assume $0 discretionary when
 * recurring estimates exceed the 30-day spend window (annual bills, lag).
 */
export function resolveDiscretionaryMonthly(spendingLast30Days, confirmedRecurringMonthly) {
  const spending = Math.max(0, spendingLast30Days)
  const recurring = Math.max(0, confirmedRecurringMonthly)
  const cappedRecurring = Math.min(recurring, spending * 0.95)
  return roundCurrency(Math.max(0, spending - cappedRecurring))
}

/**
 * Runway from the simulated daily points: first day projected balance <= 0.
 * Falls back to average daily burn when the horizon never goes non-positive.
 */
export function resolveRunwayDays(points, startingBalance, dailyBurn) {
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].balance <= 0) {
      return index
    }
  }

  if (dailyBurn > 0 && startingBalance > 0) {
    return Math.round((startingBalance / dailyBurn) * 10) / 10
  }

  return null
}

/**
 * Builds daily balance points from today through horizonDays.
 */
export function buildCashFlowForecast({
  startingBalance = 0,
  incomeLast30Days = 0,
  spendingLast30Days = 0,
  confirmedRecurringMonthly = 0,
  recurringCharges = [],
  horizonDays = FORECAST_HORIZON_DAYS,
  referenceDate = new Date(),
} = {}) {
  const todayIso = formatIsoDate(referenceDate)
  const endDate = addDaysToIso(todayIso, horizonDays)

  const dailyIncome = roundCurrency(incomeLast30Days / 30)
  const discretionaryMonthly = resolveDiscretionaryMonthly(
    spendingLast30Days,
    confirmedRecurringMonthly
  )
  const dailyDiscretionary = roundCurrency(discretionaryMonthly / 30)

  // Include today so bills due today appear in the list and today's balance point.
  const scheduledOutflows = buildScheduledOutflows(recurringCharges, {
    startDate: todayIso,
    endDate,
  })
  const outflowsByDate = indexEventsByDate(scheduledOutflows)

  const todayRecurring = roundCurrency(
    (outflowsByDate.get(todayIso) ?? []).reduce((sum, event) => sum + event.amount, 0)
  )

  let balance = roundCurrency(startingBalance - todayRecurring)
  let lowestBalance = balance
  let lowestBalanceDate = todayIso

  const points = [
    {
      date: todayIso,
      balance,
      income: 0,
      discretionarySpend: 0,
      recurringSpend: todayRecurring,
      label: 'Today',
    },
  ]

  for (let dayOffset = 1; dayOffset <= horizonDays; dayOffset += 1) {
    const date = addDaysToIso(todayIso, dayOffset)
    const recurringSpend = roundCurrency(
      (outflowsByDate.get(date) ?? []).reduce((sum, event) => sum + event.amount, 0)
    )

    balance = roundCurrency(balance + dailyIncome - dailyDiscretionary - recurringSpend)

    if (balance < lowestBalance) {
      lowestBalance = balance
      lowestBalanceDate = date
    }

    points.push({
      date,
      balance,
      income: dailyIncome,
      discretionarySpend: dailyDiscretionary,
      recurringSpend,
    })
  }

  const dailyBurn = roundCurrency(dailyDiscretionary + confirmedRecurringMonthly / 30)
  const runwayDays = resolveRunwayDays(points, roundCurrency(startingBalance), dailyBurn)

  return {
    horizonDays,
    startDate: todayIso,
    endDate,
    startingBalance: roundCurrency(startingBalance),
    endingBalance: points[points.length - 1]?.balance ?? roundCurrency(startingBalance),
    lowestBalance,
    lowestBalanceDate,
    runwayDays,
    assumptions: {
      dailyIncome,
      dailyDiscretionary,
      incomeLast30Days: roundCurrency(incomeLast30Days),
      spendingLast30Days: roundCurrency(spendingLast30Days),
      confirmedRecurringMonthly: roundCurrency(confirmedRecurringMonthly),
    },
    // Cap for response size — enough for a 30-day bill calendar view.
    scheduledOutflows: scheduledOutflows.slice(0, 40),
    points,
    hasBaselineData: spendingLast30Days > 0 || incomeLast30Days > 0,
  }
}

export function daysUntil(isoDate, referenceDate = new Date()) {
  const target = parseIsoDate(isoDate).getTime()
  const start = parseIsoDate(formatIsoDate(referenceDate)).getTime()
  return Math.max(0, Math.round((target - start) / MS_PER_DAY))
}

export function summarizeForecastRisk(forecast) {
  if (!forecast) {
    return null
  }

  if (!forecast.hasBaselineData) {
    return {
      tone: 'warning',
      title: 'Not enough history yet',
      detail:
        'This projection is mostly your current balance. Check back after a few days of synced transactions.',
      lowestBalanceDate: forecast.lowestBalanceDate,
    }
  }

  if (forecast.startingBalance < 0) {
    return {
      tone: 'danger',
      title: 'Balance is negative',
      detail: 'Connect accounts and review recent charges before relying on this projection.',
      lowestBalanceDate: forecast.lowestBalanceDate,
    }
  }

  if (forecast.lowestBalance < 0) {
    return {
      tone: 'danger',
      title: 'Projected shortfall ahead',
      detail: `Balance may dip to about $${Math.abs(forecast.lowestBalance).toFixed(0)}.`,
      lowestBalanceDate: forecast.lowestBalanceDate,
    }
  }

  if (forecast.runwayDays != null && forecast.runwayDays < 14) {
    return {
      tone: 'warning',
      title: 'Cash runway is tight',
      detail: `At your recent pace, connected balances cover about ${forecast.runwayDays} days.`,
      lowestBalanceDate: forecast.lowestBalanceDate,
    }
  }

  if (forecast.endingBalance < forecast.startingBalance) {
    return {
      tone: 'warning',
      title: 'Spending may outpace income',
      detail: `Projected balance in ${forecast.horizonDays} days is lower than today.`,
      lowestBalanceDate: forecast.lowestBalanceDate,
    }
  }

  return {
    tone: 'brand',
    title: 'Cash flow looks stable',
    detail: `Projected balance stays positive over the next ${forecast.horizonDays} days.`,
    lowestBalanceDate: forecast.lowestBalanceDate,
  }
}
