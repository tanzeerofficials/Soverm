/*
 * PAYDAY SERVICE
 *
 * Loads/saves user payday preferences and optionally infers from deposits.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { formatIsoDateInAppTz } from '../utils/calendarMonth.js'
import {
  advancePaydayToFuture,
  daysUntilPayday,
  inferPaydayFromDeposits,
  isValidIsoDate,
  isValidPayCadence,
} from '../utils/paydayInference.js'

const EXCLUDE_TRANSFER_FILTER = `
  AND COALESCE(t.category, '') !~* 'transfer'
  AND COALESCE(t.name, '') !~* '\\btransfer\\b'
`

function mapProfile(row, referenceDate = new Date()) {
  if (!row) {
    return {
      configured: false,
      payCadence: null,
      nextPaydayOn: null,
      paydaySource: null,
      paydayUpdatedAt: null,
      daysUntilPayday: null,
    }
  }

  const todayIso = formatIsoDateInAppTz(referenceDate)
  let nextPaydayOn = row.next_payday_on
    ? String(row.next_payday_on).slice(0, 10)
    : null
  const payCadence = row.pay_cadence ?? null

  if (nextPaydayOn && payCadence) {
    nextPaydayOn = advancePaydayToFuture(nextPaydayOn, payCadence, todayIso)
  }

  return {
    configured: Boolean(nextPaydayOn && payCadence),
    payCadence,
    nextPaydayOn,
    paydaySource: row.payday_source ?? null,
    paydayUpdatedAt: row.payday_updated_at ?? null,
    daysUntilPayday: daysUntilPayday(nextPaydayOn, referenceDate),
  }
}

export async function hasPaydayColumns() {
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'next_payday_on'`
  )
  return result.rows.length > 0
}

export async function getPaydayProfile(userId, { referenceDate = new Date() } = {}) {
  if (!(await hasPaydayColumns())) {
    return mapProfile(null, referenceDate)
  }

  const result = await db.query(
    `SELECT pay_cadence, next_payday_on, payday_source, payday_updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  )

  return mapProfile(result.rows[0] ?? null, referenceDate)
}

export async function loadIncomeDeposits(userId, { lookbackDays = 120 } = {}) {
  const result = await db.query(
    `SELECT t.date::text AS date, t.amount
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND (t.pending IS NOT TRUE)
       AND t.amount < 0
       ${EXCLUDE_TRANSFER_FILTER}
       AND t.date >= (CURRENT_DATE - ($2::int || ' days')::interval)
     ORDER BY t.date ASC`,
    [userId, lookbackDays]
  )

  return result.rows.map((row) => ({
    date: String(row.date).slice(0, 10),
    amount: Number(row.amount),
  }))
}

export async function inferPaydayFromTransactions(userId, { referenceDate = new Date() } = {}) {
  const deposits = await loadIncomeDeposits(userId)
  return inferPaydayFromDeposits(deposits, { referenceDate })
}

export async function upsertPayday(
  userId,
  { payCadence, nextPaydayOn, source = 'user' } = {}
) {
  if (!(await hasPaydayColumns())) {
    const error = new Error('Payday preferences are not available yet')
    error.statusCode = 503
    throw error
  }

  if (!isValidPayCadence(payCadence)) {
    const error = new Error('payCadence must be weekly, biweekly, semimonthly, or monthly')
    error.statusCode = 400
    throw error
  }

  if (!isValidIsoDate(nextPaydayOn)) {
    const error = new Error('nextPaydayOn must be YYYY-MM-DD')
    error.statusCode = 400
    throw error
  }

  if (source !== 'inferred' && source !== 'user') {
    const error = new Error('source must be inferred or user')
    error.statusCode = 400
    throw error
  }

  const todayIso = formatIsoDateInAppTz()
  const resolvedNext = advancePaydayToFuture(nextPaydayOn, payCadence, todayIso)

  const result = await db.query(
    `UPDATE users
     SET pay_cadence = $2,
         next_payday_on = $3::date,
         payday_source = $4,
         payday_updated_at = NOW()
     WHERE id = $1
     RETURNING pay_cadence, next_payday_on, payday_source, payday_updated_at`,
    [userId, payCadence, resolvedNext, source]
  )

  if (result.rows.length === 0) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  return mapProfile(result.rows[0])
}
