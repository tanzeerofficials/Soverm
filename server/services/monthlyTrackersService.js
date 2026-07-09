/*
 * MONTHLY TRACKERS SERVICE
 *
 * CRUD for spending caps and savings goals in one table.
 */

import db from '../db/index.js'
import {
  computeMonthlyProgressUpdate,
  mapTrackerRow,
  MAX_SAVING_TRACKERS,
  parseCreateTrackerInput,
  parseUpdateTrackerInput,
} from '../utils/monthlyTrackers.js'

const TRACKER_SELECT_COLUMNS = `id, user_id, track_type, name, purpose_type, monthly_amount,
            target_total, progress_amount, monthly_progress_amount, progress_month,
            active, created_at, updated_at`

const LEGACY_TRACKER_SELECT_COLUMNS = `id, user_id, track_type, name, purpose_type, monthly_amount,
            target_total, progress_amount, active, created_at, updated_at`

async function getTrackerSelectColumns() {
  if (await monthlyProgressColumnsExist()) {
    return TRACKER_SELECT_COLUMNS
  }

  return LEGACY_TRACKER_SELECT_COLUMNS
}

async function tableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'`
  )

  return result.rows.length > 0
}

async function monthlyProgressColumnsExist() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'
       AND column_name = 'monthly_progress_amount'`
  )

  return result.rows.length > 0
}

/**
 * Zeroes monthly progress when the stored month is before the current calendar month.
 * Lifetime total (progress_amount) is left unchanged.
 */
export async function resetStaleMonthlyProgress(userId) {
  if (!(await tableExists()) || !(await monthlyProgressColumnsExist())) {
    return
  }

  await db.query(
    `UPDATE monthly_trackers
     SET monthly_progress_amount = 0,
         progress_month = date_trunc('month', CURRENT_DATE)::date,
         updated_at = NOW()
     WHERE user_id = $1
       AND track_type = 'saving'
       AND active = true
       AND (
         progress_month IS NULL
         OR progress_month < date_trunc('month', CURRENT_DATE)::date
       )`,
    [userId]
  )
}

export async function listActiveTrackers(userId) {
  if (!(await tableExists())) {
    return []
  }

  await resetStaleMonthlyProgress(userId)

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
  if (!(await tableExists())) {
    throw new Error('Monthly trackers are not available yet — run migration 013')
  }

  const parsed = parseCreateTrackerInput(body)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const { trackType, name, purposeType, monthlyAmount, targetTotal } = parsed.value

  if (trackType === 'spending') {
    const existing = await getActiveSpendingTracker(userId)
    if (existing) {
      return updateTracker(userId, existing.id, {
        name,
        monthlyAmount,
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
  const result = await db.query(
    `INSERT INTO monthly_trackers (
       user_id, track_type, name, purpose_type, monthly_amount, target_total
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${selectColumns}`,
    [userId, trackType, name, purposeType, monthlyAmount, targetTotal]
  )

  return mapTrackerRow(result.rows[0])
}

export async function updateTracker(userId, trackerId, body) {
  if (!(await tableExists())) {
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

  if (trackType === 'spending' && (updates.purposeType != null || updates.targetTotal !== undefined || updates.progressAmount != null)) {
    const error = new Error('Spending trackers only support name and monthlyAmount')
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
  if (updates.progressAmount != null) {
    if (trackType !== 'saving') {
      const error = new Error('progressAmount applies to saving trackers only')
      error.statusCode = 400
      throw error
    }

    if (!(await monthlyProgressColumnsExist())) {
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

  return mapTrackerRow(result.rows[0])
}

export async function deleteTracker(userId, trackerId) {
  if (!(await tableExists())) {
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

  return { id: trackerId }
}
