/*
 * MONTHLY TRACKERS SERVICE
 *
 * CRUD for spending caps and savings goals in one table.
 */

import db from '../db/index.js'
import {
  mapTrackerRow,
  MAX_SAVING_TRACKERS,
  parseCreateTrackerInput,
  parseUpdateTrackerInput,
} from '../utils/monthlyTrackers.js'

async function tableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'`
  )

  return result.rows.length > 0
}

export async function listActiveTrackers(userId) {
  if (!(await tableExists())) {
    return []
  }

  const result = await db.query(
    `SELECT id, user_id, track_type, name, purpose_type, monthly_amount,
            target_total, progress_amount, active, created_at, updated_at
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

  const result = await db.query(
    `INSERT INTO monthly_trackers (
       user_id, track_type, name, purpose_type, monthly_amount, target_total
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, track_type, name, purpose_type, monthly_amount,
               target_total, progress_amount, active, created_at, updated_at`,
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

  const existing = await db.query(
    `SELECT id, track_type FROM monthly_trackers
     WHERE id = $1 AND user_id = $2 AND active = true`,
    [trackerId, userId]
  )

  if (existing.rows.length === 0) {
    const error = new Error('Tracker not found')
    error.statusCode = 404
    throw error
  }

  const trackType = existing.rows[0].track_type
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
    fields.push(`progress_amount = $${paramIndex++}`)
    values.push(updates.progressAmount)
  }

  fields.push('updated_at = NOW()')

  const result = await db.query(
    `UPDATE monthly_trackers
     SET ${fields.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, track_type, name, purpose_type, monthly_amount,
               target_total, progress_amount, active, created_at, updated_at`,
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
