/*
 * SAVINGS TRANSFER DETECTION SERVICE
 *
 * Scans recent transactions after sync, stores pending detections,
 * and applies or dismisses them on user action.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { listActiveTrackers } from './monthlyTrackersService.js'
import {
  detectSavingsTransferCandidates,
  suggestTrackerForDetection,
} from '../utils/savingsTransferDetection.js'
import {
  computeMonthlyProgressUpdate,
  getCurrentProgressMonth,
  mapTrackerRow,
  resolveMonthlySaved,
} from '../utils/monthlyTrackers.js'
import {
  hasMonthlyProgressColumns,
  hasMonthlyTrackersTable,
} from '../utils/monthlyTrackersSchema.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import { calendarMonthSqlBounds } from '../utils/calendarMonth.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

let detectionsTableCache = null
let detectionsTableCheckedAt = 0
const DETECTIONS_TABLE_CACHE_TTL_MS = 60_000

async function hasSavingsTransferDetectionsTable() {
  if (
    detectionsTableCache !== null &&
    Date.now() - detectionsTableCheckedAt < DETECTIONS_TABLE_CACHE_TTL_MS
  ) {
    return detectionsTableCache
  }

  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'savings_transfer_detections'`
  )

  detectionsTableCache = result.rows.length > 0
  detectionsTableCheckedAt = Date.now()
  return detectionsTableCache
}

/** Test helper */
export function resetSavingsTransferDetectionsTableCache() {
  detectionsTableCache = null
  detectionsTableCheckedAt = 0
}

async function loadCandidateTransactions(userId) {
  const { startIso, endExclusiveIso } = calendarMonthSqlBounds()

  const result = await db.query(
    `SELECT t.id, t.account_id, t.amount, t.name, t.date, t.pending,
            a.account_name, a.bank_name, a.account_type
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date
       AND NOT EXISTS (
         SELECT 1
         FROM savings_transfer_detections std
         WHERE std.transaction_id = t.id
           AND std.user_id = t.user_id
       )`,
    [userId, startIso, endExclusiveIso]
  )

  return result.rows
}

function mapDetectionRow(row) {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    trackerId: row.tracker_id,
    amount: roundCurrency(row.amount),
    merchantName: row.merchant_name,
    transactionDate: row.transaction_date,
    accountLabel: row.account_label,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

export async function listPendingSavingsTransferDetections(userId) {
  if (!(await hasSavingsTransferDetectionsTable())) {
    return []
  }

  const result = await db.query(
    `SELECT id, transaction_id, tracker_id, amount, merchant_name,
            transaction_date, account_label, status, created_at, resolved_at
     FROM savings_transfer_detections
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY transaction_date DESC, created_at DESC`,
    [userId]
  )

  return result.rows.map(mapDetectionRow)
}

export async function scanAndStoreSavingsTransferDetections(userId) {
  if (!(await hasSavingsTransferDetectionsTable())) {
    return { created: 0, skipped: 'migration_017_missing' }
  }

  const savingTrackers = (await listActiveTrackers(userId)).filter(
    (tracker) => tracker.trackType === 'saving'
  )

  if (savingTrackers.length === 0) {
    return { created: 0, skipped: 'no_saving_trackers' }
  }

  const rows = await loadCandidateTransactions(userId)
  const accountsById = new Map()

  for (const row of rows) {
    accountsById.set(row.account_id, {
      account_name: row.account_name,
      bank_name: row.bank_name,
      account_type: row.account_type,
    })
  }

  const candidates = detectSavingsTransferCandidates(rows, accountsById)
  let created = 0

  for (const candidate of candidates) {
    const suggestedTrackerId = suggestTrackerForDetection(candidate, savingTrackers)
    const insertResult = await db.query(
      `INSERT INTO savings_transfer_detections (
         user_id, transaction_id, tracker_id, amount, merchant_name,
         transaction_date, account_label, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (user_id, transaction_id) DO NOTHING
       RETURNING id`,
      [
        userId,
        candidate.transactionId,
        suggestedTrackerId,
        candidate.amount,
        candidate.merchantName,
        candidate.date,
        candidate.accountLabel,
      ]
    )

    if (insertResult.rows.length > 0) {
      created += 1
    }
  }

  return { created }
}

/**
 * Applies a pending savings-transfer detection to a savings goal.
 *
 * What it does:
 * - Claims the detection row with FOR UPDATE so only one request can apply it
 * - Adds the transfer amount to that goal's monthly saved progress
 * - Marks the detection applied in the same DB transaction
 *
 * Why we need it:
 * - Without a transaction + pending claim, two clicks (or a retry after a
 *   partial failure) can credit the same transfer twice.
 * - If the user already logged the same dollar amount this month, we ask
 *   them to confirm with force: true so we do not silently double-count.
 *
 * How it fits the app:
 * - Tracker panel "Confirm" calls POST .../savings-detections/:id/apply
 * - Progress uses the same monthly_progress_amount fields as manual logging
 */
export async function applySavingsTransferDetection(
  userId,
  detectionId,
  trackerId,
  { force = false } = {}
) {
  if (!(await hasSavingsTransferDetectionsTable())) {
    const error = new Error('Savings transfer detections are not available yet — run migration 017')
    error.statusCode = 503
    throw error
  }

  if (!(await hasMonthlyTrackersTable()) || !(await hasMonthlyProgressColumns())) {
    const error = new Error('Monthly savings progress is not available yet — run migration 014')
    error.statusCode = 503
    throw error
  }

  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const claimResult = await client.query(
      `SELECT id, transaction_id, tracker_id, amount, status, transaction_date
       FROM savings_transfer_detections
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       FOR UPDATE`,
      [detectionId, userId]
    )

    if (claimResult.rows.length === 0) {
      const existing = await client.query(
        `SELECT id, status
         FROM savings_transfer_detections
         WHERE id = $1 AND user_id = $2`,
        [detectionId, userId]
      )

      if (existing.rows.length === 0) {
        const error = new Error('Detection not found')
        error.statusCode = 404
        throw error
      }

      const error = new Error('This detection was already resolved')
      error.statusCode = 400
      throw error
    }

    const detection = claimResult.rows[0]
    const appliedAmount = roundCurrency(detection.amount)
    const targetTrackerId = trackerId ?? detection.tracker_id

    if (!targetTrackerId) {
      const error = new Error('trackerId is required')
      error.statusCode = 400
      throw error
    }

    // Zero stale monthly progress inside this transaction before we read it.
    const currentMonth = getCurrentProgressMonth()
    await client.query(
      `UPDATE monthly_trackers
       SET monthly_progress_amount = 0,
           progress_month = $1::date,
           updated_at = NOW()
       WHERE user_id = $2
         AND track_type = 'saving'
         AND active = true
         AND (
           progress_month IS NULL
           OR progress_month < $1::date
         )`,
      [currentMonth, userId]
    )

    const trackerResult = await client.query(
      `SELECT id, user_id, track_type, name, purpose_type, monthly_amount,
              target_total, progress_amount, monthly_progress_amount, progress_month,
              active, created_at, updated_at
       FROM monthly_trackers
       WHERE id = $1 AND user_id = $2 AND active = true AND track_type = 'saving'
       FOR UPDATE`,
      [targetTrackerId, userId]
    )

    if (trackerResult.rows.length === 0) {
      const error = new Error('Savings goal not found')
      error.statusCode = 404
      throw error
    }

    const tracker = mapTrackerRow(trackerResult.rows[0])
    const currentMonthly = resolveMonthlySaved(tracker)

    // Same dollar amount already logged this month → likely the same transfer.
    // Require an explicit force confirm so we do not stack manual + detected credit.
    if (
      !force &&
      currentMonthly > 0 &&
      Math.abs(currentMonthly - appliedAmount) < 0.005
    ) {
      const error = new Error(
        `This goal already has ${appliedAmount.toFixed(2)} logged this month, which may be the same transfer. Confirm again to add it anyway.`
      )
      error.statusCode = 409
      error.code = 'possible_duplicate'
      throw error
    }

    const nextMonthly = roundCurrency(currentMonthly + appliedAmount)
    const progressUpdate = computeMonthlyProgressUpdate(tracker, nextMonthly)

    await client.query(
      `UPDATE monthly_trackers
       SET monthly_progress_amount = $1,
           progress_month = $2::date,
           progress_amount = $3,
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5`,
      [
        progressUpdate.monthlyProgressAmount,
        progressUpdate.progressMonth,
        progressUpdate.progressAmount,
        targetTrackerId,
        userId,
      ]
    )

    const appliedResult = await client.query(
      `UPDATE savings_transfer_detections
       SET status = 'applied',
           tracker_id = $1,
           resolved_at = NOW()
       WHERE id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING id`,
      [targetTrackerId, detectionId, userId]
    )

    if (appliedResult.rows.length === 0) {
      const error = new Error('This detection was already resolved')
      error.statusCode = 400
      throw error
    }

    await client.query('COMMIT')

    return {
      detectionId,
      trackerId: targetTrackerId,
      appliedAmount,
      monthlySaved: progressUpdate.monthlyProgressAmount,
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Transaction may already be closed.
    }
    throw err
  } finally {
    client.release()
  }
}

export async function dismissSavingsTransferDetection(userId, detectionId) {
  if (!(await hasSavingsTransferDetectionsTable())) {
    const error = new Error('Savings transfer detections are not available yet — run migration 017')
    error.statusCode = 503
    throw error
  }

  const result = await db.query(
    `UPDATE savings_transfer_detections
     SET status = 'dismissed',
         resolved_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id`,
    [detectionId, userId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Detection not found')
    error.statusCode = 404
    throw error
  }

  return { detectionId }
}
