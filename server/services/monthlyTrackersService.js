/*
 * MONTHLY TRACKERS SERVICE
 *
 * CRUD for spending caps and savings goals in one table.
 */

import db from '../db/index.js'
import {
  hasAlertThresholdColumns,
  hasMonthlyProgressColumns,
  hasMonthlyTrackersTable,
} from '../utils/monthlyTrackersSchema.js'
import {
  computeMonthlyProgressUpdate,
  mapTrackerRow,
  MAX_SAVING_TRACKERS,
  parseCreateTrackerInput,
  parseUpdateTrackerInput,
} from '../utils/monthlyTrackers.js'
import { getCurrentProgressMonth } from '../utils/calendarMonth.js'
import { invalidateChatFinancialSnapshot } from '../utils/chatFinancialSnapshotCache.js'

const BASE_TRACKER_SELECT_COLUMNS = `id, user_id, track_type, name, purpose_type, monthly_amount,
            target_total, progress_amount, active, created_at, updated_at`

async function getTrackerSelectColumns() {
  const parts = [BASE_TRACKER_SELECT_COLUMNS]

  if (await hasMonthlyProgressColumns()) {
    parts.push('monthly_progress_amount, progress_month')
  }

  if (await hasAlertThresholdColumns()) {
    parts.push('alert_warning_percent, alert_remaining_dollars')
  }

  return parts.join(', ')
}

/**
 * Zeroes monthly progress when the stored month is before the current calendar month.
 * Lifetime total (progress_amount) is left unchanged.
 *
 * Uses the app-timezone month start (not Postgres CURRENT_DATE) so SQL and
 * Node agree at month boundaries.
 */
export async function resetStaleMonthlyProgress(userId) {
  if (!(await hasMonthlyTrackersTable()) || !(await hasMonthlyProgressColumns())) {
    return
  }

  const currentMonth = getCurrentProgressMonth()

  await db.query(
    `UPDATE monthly_trackers
     SET monthly_progress_amount = 0,
         progress_month = $2::date,
         updated_at = NOW()
     WHERE user_id = $1
       AND track_type = 'saving'
       AND active = true
       AND (
         progress_month IS NULL
         OR progress_month < $2::date
       )`,
    [userId, currentMonth]
  )
}

export async function listActiveTrackers(userId, { persistMonthReset = false } = {}) {
  if (!(await hasMonthlyTrackersTable())) {
    return []
  }

  // Persist month rollover only on write paths (create/update/apply).
  // GET/list should not mutate savings progress as a side effect of reading.
  if (persistMonthReset) {
    await resetStaleMonthlyProgress(userId)
  }

  const selectColumns = await getTrackerSelectColumns()
  const result = await db.query(
    `SELECT ${selectColumns}
     FROM monthly_trackers
     WHERE user_id = $1 AND active = true
     ORDER BY track_type ASC, created_at ASC`,
    [userId]
  )

  return result.rows.map(mapTrackerRow)
}

async function countActiveSavingTrackers(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM monthly_trackers
     WHERE user_id = $1 AND track_type = 'saving' AND active = true`,
    [userId]
  )

  return result.rows[0]?.count ?? 0
}

async function getActiveSpendingTracker(userId) {
  const result = await db.query(
    `SELECT id FROM monthly_trackers
     WHERE user_id = $1 AND track_type = 'spending' AND active = true
     LIMIT 1`,
    [userId]
  )

  return result.rows[0] ?? null
}

export async function createTracker(userId, body) {
  if (!(await hasMonthlyTrackersTable())) {
    throw new Error('Monthly trackers are not available yet — run migration 013')
  }

  const parsed = parseCreateTrackerInput(body)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const {
    trackType,
    name,
    purposeType,
    monthlyAmount,
    targetTotal,
    alertWarningPercent,
    alertRemainingDollars,
  } = parsed.value

  if (trackType === 'saving') {
    await resetStaleMonthlyProgress(userId)
  }
  if (trackType === 'spending') {
    const existing = await getActiveSpendingTracker(userId)
    if (existing) {
      return updateTracker(userId, existing.id, {
        name,
        monthlyAmount,
        ...(alertWarningPercent !== undefined ? { alertWarningPercent } : {}),
        ...(alertRemainingDollars !== undefined ? { alertRemainingDollars } : {}),
      })
    }
  }

  if (trackType === 'saving') {
    const savingCount = await countActiveSavingTrackers(userId)
    if (savingCount >= MAX_SAVING_TRACKERS) {
      const error = new Error(`You can have at most ${MAX_SAVING_TRACKERS} active saving trackers`)
      error.statusCode = 400
      throw error
    }
  }

  const selectColumns = await getTrackerSelectColumns()

  const canStoreAlerts = trackType === 'spending' && (await hasAlertThresholdColumns())
  const insertColumns = [
    'user_id',
    'track_type',
    'name',
    'purpose_type',
    'monthly_amount',
    'target_total',
  ]
  const insertValues = [userId, trackType, name, purposeType, monthlyAmount, targetTotal]

  if (canStoreAlerts) {
    insertColumns.push('alert_warning_percent', 'alert_remaining_dollars')
    insertValues.push(alertWarningPercent ?? null, alertRemainingDollars ?? null)
  }

  const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ')

  try {
    const result = await db.query(
      `INSERT INTO monthly_trackers (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING ${selectColumns}`,
      insertValues
    )

    invalidateChatFinancialSnapshot(userId)
    return mapTrackerRow(result.rows[0])
  } catch (err) {
    // Race: two spending-cap creates at once — unique index enforces one active row.
    if (err.code === '23505' && trackType === 'spending') {
      const existing = await getActiveSpendingTracker(userId)
      if (existing) {
        return updateTracker(userId, existing.id, {
          name,
          monthlyAmount,
          ...(alertWarningPercent !== undefined ? { alertWarningPercent } : {}),
          ...(alertRemainingDollars !== undefined ? { alertRemainingDollars } : {}),
        })
      }
    }

    throw err
  }
}

export async function updateTracker(userId, trackerId, body) {
  if (!(await hasMonthlyTrackersTable())) {
    throw new Error('Monthly trackers are not available yet — run migration 013')
  }

  const parsed = parseUpdateTrackerInput(body)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const selectColumns = await getTrackerSelectColumns()
  const existing = await db.query(
    `SELECT ${selectColumns}
     FROM monthly_trackers
     WHERE id = $1 AND user_id = $2 AND active = true`,
    [trackerId, userId]
  )

  if (existing.rows.length === 0) {
    const error = new Error('Tracker not found')
    error.statusCode = 404
    throw error
  }

  const trackType = mapTrackerRow(existing.rows[0]).trackType
  const updates = parsed.value

  if (
    trackType === 'spending' &&
    (updates.purposeType != null || updates.targetTotal !== undefined || updates.progressAmount != null)
  ) {
    const error = new Error('Spending trackers only support name, monthlyAmount, and alert thresholds')
    error.statusCode = 400
    throw error
  }

  if (
    trackType === 'saving' &&
    (updates.alertWarningPercent !== undefined || updates.alertRemainingDollars !== undefined)
  ) {
    const error = new Error('Alert thresholds apply to spending trackers only')
    error.statusCode = 400
    throw error
  }

  if (
    (updates.alertWarningPercent !== undefined || updates.alertRemainingDollars !== undefined) &&
    !(await hasAlertThresholdColumns())
  ) {
    const error = new Error('Custom alert thresholds are not available yet — run migration 016')
    error.statusCode = 503
    throw error
  }

  const existingTracker = mapTrackerRow(existing.rows[0])
  const effectiveMonthly =
    updates.monthlyAmount != null ? updates.monthlyAmount : existingTracker.monthlyAmount
  const effectiveRemainingDollars =
    updates.alertRemainingDollars !== undefined
      ? updates.alertRemainingDollars
      : existingTracker.alertRemainingDollars

  if (
    trackType === 'spending' &&
    effectiveRemainingDollars != null &&
    effectiveRemainingDollars >= effectiveMonthly
  ) {
    const error = new Error(
      'alertRemainingDollars must be less than monthlyAmount (otherwise the warning fires immediately)'
    )
    error.statusCode = 400
    throw error
  }

  const fields = []
  const values = [trackerId, userId]
  let paramIndex = 3

  if (updates.name != null) {
    fields.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.purposeType != null) {
    fields.push(`purpose_type = $${paramIndex++}`)
    values.push(updates.purposeType)
  }
  if (updates.monthlyAmount != null) {
    fields.push(`monthly_amount = $${paramIndex++}`)
    values.push(updates.monthlyAmount)
  }
  if (updates.targetTotal !== undefined) {
    fields.push(`target_total = $${paramIndex++}`)
    values.push(updates.targetTotal)
  }
  if (updates.alertWarningPercent !== undefined) {
    fields.push(`alert_warning_percent = $${paramIndex++}`)
    values.push(updates.alertWarningPercent)
  }
  if (updates.alertRemainingDollars !== undefined) {
    fields.push(`alert_remaining_dollars = $${paramIndex++}`)
    values.push(updates.alertRemainingDollars)
  }
  if (updates.progressAmount != null) {
    if (trackType !== 'saving') {
      const error = new Error('progressAmount applies to saving trackers only')
      error.statusCode = 400
      throw error
    }

    if (!(await hasMonthlyProgressColumns())) {
      const error = new Error('Monthly savings progress is not available yet — run migration 014')
      error.statusCode = 503
      throw error
    }

    await resetStaleMonthlyProgress(userId)

    const refreshed = await db.query(
      `SELECT ${selectColumns}
       FROM monthly_trackers
       WHERE id = $1 AND user_id = $2 AND active = true`,
      [trackerId, userId]
    )

    const progressUpdate = computeMonthlyProgressUpdate(
      mapTrackerRow(refreshed.rows[0]),
      updates.progressAmount
    )

    fields.push(`monthly_progress_amount = $${paramIndex++}`)
    values.push(progressUpdate.monthlyProgressAmount)
    fields.push(`progress_month = $${paramIndex++}`)
    values.push(progressUpdate.progressMonth)
    fields.push(`progress_amount = $${paramIndex++}`)
    values.push(progressUpdate.progressAmount)
  }

  fields.push('updated_at = NOW()')

  const result = await db.query(
    `UPDATE monthly_trackers
     SET ${fields.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING ${selectColumns}`,
    values
  )

  invalidateChatFinancialSnapshot(userId)
  return mapTrackerRow(result.rows[0])
}

export async function deleteTracker(userId, trackerId) {
  if (!(await hasMonthlyTrackersTable())) {
    throw new Error('Monthly trackers are not available yet — run migration 013')
  }

  const result = await db.query(
    `UPDATE monthly_trackers
     SET active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND active = true
     RETURNING id`,
    [trackerId, userId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Tracker not found')
    error.statusCode = 404
    throw error
  }

  invalidateChatFinancialSnapshot(userId)
  return { id: trackerId }
}
