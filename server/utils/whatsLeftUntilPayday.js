/*
 * WHAT'S LEFT UNTIL PAYDAY
 *
 * Paycheck-to-paycheck remaining money:
 *   max(0, netBalance − billsUntilPaydayTotal − bufferReserve)
 *
 * Separate from spending-cap safe-to-spend (tracker monthly limit).
 */

import { roundCurrency } from './safeToSpend.js'
import { buildScheduledOutflows } from './cashFlowForecast.js'
import { formatIsoDateInAppTz } from './calendarMonth.js'
import { daysUntilPayday } from './paydayInference.js'

export const DEFAULT_BUFFER_RESERVE = 0

/**
 * Bills due from today through nextPaydayOn (inclusive), from recurring charges.
 */
export function buildBillsUntilPayday(
  recurringCharges = [],
  { todayIso, nextPaydayOn } = {}
) {
  if (!todayIso || !nextPaydayOn || nextPaydayOn < todayIso) {
    return []
  }

  return buildScheduledOutflows(recurringCharges, {
    startDate: todayIso,
    endDate: nextPaydayOn,
  }).map((event) => ({
    date: event.date,
    amount: roundCurrency(event.amount),
    merchant: event.merchant,
    cadence: event.cadence,
  }))
}

/**
 * @param {{
 *   netBalance?: number,
 *   nextPaydayOn?: string | null,
 *   payCadence?: string | null,
 *   recurringCharges?: array,
 *   bufferReserve?: number,
 *   referenceDate?: Date,
 * }} input
 */
export function computeWhatsLeftUntilPayday({
  netBalance = 0,
  nextPaydayOn = null,
  payCadence = null,
  recurringCharges = [],
  bufferReserve = DEFAULT_BUFFER_RESERVE,
  referenceDate = new Date(),
} = {}) {
  const balance = roundCurrency(netBalance)
  const buffer = roundCurrency(Math.max(0, bufferReserve))
  const todayIso = formatIsoDateInAppTz(referenceDate)

  if (!nextPaydayOn || !payCadence) {
    return {
      configured: false,
      amount: null,
      netBalance: balance,
      billsUntilPaydayTotal: null,
      bufferReserve: buffer,
      nextPaydayOn: null,
      daysUntilPayday: null,
      payCadence: null,
      bills: [],
    }
  }

  const paydayIso = String(nextPaydayOn).slice(0, 10)
  const bills = buildBillsUntilPayday(recurringCharges, {
    todayIso,
    nextPaydayOn: paydayIso,
  })
  const billsUntilPaydayTotal = roundCurrency(
    bills.reduce((sum, bill) => sum + bill.amount, 0)
  )
  const amount = roundCurrency(Math.max(0, balance - billsUntilPaydayTotal - buffer))

  return {
    configured: true,
    amount,
    netBalance: balance,
    billsUntilPaydayTotal,
    bufferReserve: buffer,
    nextPaydayOn: paydayIso,
    daysUntilPayday: daysUntilPayday(paydayIso, referenceDate),
    payCadence,
    bills,
  }
}
