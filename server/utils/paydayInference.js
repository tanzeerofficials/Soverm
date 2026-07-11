/*
 * PAYDAY INFERENCE (pure helpers)
 *
 * What this does:
 * - Looks at income deposits (credits) and guesses pay cadence + next payday
 *
 * Why:
 * - Paycheck-to-paycheck users need "what's left until payday"
 * - We can suggest a payday from bank data; the user confirms it
 *
 * Bigger picture:
 * - Stored on users via /api/payday; feeds whatsLeftUntilPayday
 *
 * Concept: Plaid amounts — spending is positive, income/deposits are negative.
 * We use abs(amount) for deposit size.
 */

import { formatIsoDateInAppTz } from './calendarMonth.js'

export const PAY_CADENCES = ['weekly', 'biweekly', 'semimonthly', 'monthly']

const CADENCE_DAYS = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
}

const MIN_DEPOSIT = 100
const MIN_SAMPLES = 3

function parseIsoDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

function daysBetween(isoA, isoB) {
  const ms = parseIsoDate(isoB) - parseIsoDate(isoA)
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function addDaysToIso(iso, days) {
  const next = parseIsoDate(iso)
  next.setDate(next.getDate() + days)
  return formatIsoDateInAppTz(next)
}

/**
 * Advances nextPaydayOn by cadence until it is on or after todayIso.
 */
export function advancePaydayToFuture(nextPaydayOn, payCadence, todayIso) {
  if (!nextPaydayOn || !payCadence) {
    return nextPaydayOn
  }

  const step = CADENCE_DAYS[payCadence] ?? 30
  let cursor = nextPaydayOn
  let guard = 0

  while (cursor < todayIso && guard < 48) {
    cursor = addDaysToIso(cursor, step)
    guard += 1
  }

  return cursor
}

function median(values) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function cadenceFromMedianGap(gap) {
  if (gap == null || !Number.isFinite(gap)) {
    return null
  }
  if (gap >= 5 && gap <= 9) {
    return 'weekly'
  }
  if (gap >= 12 && gap <= 16) {
    // Prefer biweekly for ~14; semimonthly for ~15 when closer
    return gap >= 14.5 ? 'semimonthly' : 'biweekly'
  }
  if (gap >= 26 && gap <= 35) {
    return 'monthly'
  }
  return null
}

function confidenceFor(sampleCount, gapSpread) {
  if (sampleCount >= 6 && gapSpread <= 3) {
    return 'high'
  }
  if (sampleCount >= 4 && gapSpread <= 5) {
    return 'medium'
  }
  return 'low'
}

/**
 * Infer payday from income deposit rows.
 *
 * @param {Array<{ date: string, amount: number }>} transactions
 *   amount should be Plaid-signed (income negative) or already positive deposits
 * @param {{ referenceDate?: Date }} [options]
 * @returns {{ payCadence: string, nextPaydayOn: string, confidence: string, sampleCount: number } | null}
 */
export function inferPaydayFromDeposits(transactions = [], { referenceDate = new Date() } = {}) {
  const todayIso = formatIsoDateInAppTz(referenceDate)

  const deposits = transactions
    .map((row) => {
      const raw = Number(row.amount)
      const size = raw < 0 ? Math.abs(raw) : raw
      const date = String(row.date).slice(0, 10)
      return { date, size }
    })
    .filter((row) => row.date && Number.isFinite(row.size) && row.size >= MIN_DEPOSIT)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (deposits.length < MIN_SAMPLES) {
    return null
  }

  // Prefer larger deposits (likely paycheck vs small refunds)
  const sizes = deposits.map((d) => d.size).sort((a, b) => a - b)
  const sizeFloor = sizes[Math.floor(sizes.length * 0.4)] ?? MIN_DEPOSIT
  const paycheckLike = deposits.filter((d) => d.size >= sizeFloor * 0.75)

  const series = paycheckLike.length >= MIN_SAMPLES ? paycheckLike : deposits

  const gaps = []
  for (let i = 1; i < series.length; i += 1) {
    const gap = daysBetween(series[i - 1].date, series[i].date)
    if (gap > 0 && gap <= 40) {
      gaps.push(gap)
    }
  }

  if (gaps.length < 2) {
    return null
  }

  const gapMedian = median(gaps)
  const payCadence = cadenceFromMedianGap(gapMedian)
  if (!payCadence) {
    return null
  }

  const lastDate = series[series.length - 1].date
  const step = CADENCE_DAYS[payCadence]
  let nextPaydayOn = addDaysToIso(lastDate, step)
  nextPaydayOn = advancePaydayToFuture(nextPaydayOn, payCadence, todayIso)

  const gapMin = Math.min(...gaps)
  const gapMax = Math.max(...gaps)
  const gapSpread = gapMax - gapMin

  return {
    payCadence,
    nextPaydayOn,
    confidence: confidenceFor(series.length, gapSpread),
    sampleCount: series.length,
    medianGapDays: Math.round(gapMedian * 10) / 10,
  }
}

export function daysUntilPayday(nextPaydayOn, referenceDate = new Date()) {
  if (!nextPaydayOn) {
    return null
  }
  const todayIso = formatIsoDateInAppTz(referenceDate)
  return daysBetween(todayIso, nextPaydayOn)
}

export function isValidPayCadence(value) {
  return PAY_CADENCES.includes(value)
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return false
  }
  const [year, month, day] = String(value).split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export { CADENCE_DAYS, addDaysToIso }
