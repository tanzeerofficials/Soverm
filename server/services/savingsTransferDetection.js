/*
 * SAVINGS TRANSFER DETECTION SERVICE
 *
 * Scans recent transactions after sync, stores pending detections,
 * and applies or dismisses them on user action.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { listActiveTrackers, updateTracker } from './monthlyTrackersService.js'
import {
  detectSavingsTransferCandidates,
  suggestTrackerForDetection,
} from '../utils/savingsTransferDetection.js'
import { resolveMonthlySaved } from '../utils/monthlyTrackers.js'
import { roundCurrency } from '../utils/safeToSpend.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'
const CALENDAR_MONTH_FILTER = `AND t.date >= date_trunc('month', CURRENT_DATE)::date
       AND t.date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`

let detectionsTableCache = null

async function hasSavingsTransferDetectionsTable() {
  if (detectionsTableCache !== null) {
    return detectionsTableCache
  }

  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'savings_transfer_detections'`
  )

  detectionsTableCache = result.rows.length > 0
  return detectionsTableCache
}

/** Test helper */
export function resetSavingsTransferDetectionsTableCache() {
  detectionsTableCache = null
}

async function loadCandidateTransactions(userId) {
  const result = await db.query(
    `SELECT t.id, t.account_id, t.amount, t.name, t.date, t.pending,
            a.account_name, a.bank_name, a.account_type
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       ${CALENDAR_MONTH_FILTER}
       AND NOT EXISTS (
         SELECT 1
         FROM savings_transfer_detections std
         WHERE std.transaction_id = t.id
           AND std.user_id = t.user_id
       )`,
    [userId]
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

export async function applySavingsTransferDetection(userId, detectionId, trackerId) {
  if (!(await hasSavingsTransferDetectionsTable())) {
    const error = new Error('Savings transfer detections are not available yet — run migration 017')
    error.statusCode = 503
    throw error
  }

  const detectionResult = await db.query(
    `SELECT id, transaction_id, tracker_id, amount, status
     FROM savings_transfer_detections
     WHERE id = $1 AND user_id = $2`,
    [detectionId, userId]
  )

  if (detectionResult.rows.length === 0) {
    const error = new Error('Detection not found')
    error.statusCode = 404
    throw error
  }

  const detection = detectionResult.rows[0]

  if (detection.status !== 'pending') {
    const error = new Error('This detection was already resolved')
    error.statusCode = 400
    throw error
  }

  const targetTrackerId = trackerId ?? detection.tracker_id
  if (!targetTrackerId) {
    const error = new Error('trackerId is required')
    error.statusCode = 400
    throw error
  }

  const trackers = await listActiveTrackers(userId)
  const tracker = trackers.find((row) => row.id === targetTrackerId && row.trackType === 'saving')

  if (!tracker) {
    const error = new Error('Savings goal not found')
    error.statusCode = 404
    throw error
  }

  const currentMonthly = resolveMonthlySaved(tracker)
  const nextMonthly = roundCurrency(currentMonthly + roundCurrency(detection.amount))

  await updateTracker(userId, targetTrackerId, { progressAmount: nextMonthly })

  await db.query(
    `UPDATE savings_transfer_detections
     SET status = 'applied',
         tracker_id = $1,
         resolved_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [targetTrackerId, detectionId, userId]
  )

  return { detectionId, trackerId: targetTrackerId, appliedAmount: roundCurrency(detection.amount) }
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
