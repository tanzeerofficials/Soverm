/*
 * SAVINGS GOALS SERVICE
 *
 * CRUD for plan-based monthly savings goals tied to a user.
 */

import db from '../db/index.js'
import {
  mapSavingsGoalRow,
  MAX_ACTIVE_SAVINGS_GOALS,
  parseCreateGoalInput,
  parseUpdateGoalInput,
} from '../utils/savingsGoals.js'

async function tableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'savings_goals'`
  )

  return result.rows.length > 0
}

export async function listActiveSavingsGoals(userId) {
  if (!(await tableExists())) {
    return []
  }

  const result = await db.query(
    `SELECT id, user_id, name, purpose_type, monthly_amount, target_total,
            saved_so_far, active, created_at, updated_at
     FROM savings_goals
     WHERE user_id = $1 AND active = true
     ORDER BY created_at ASC`,
    [userId]
  )

  return result.rows.map(mapSavingsGoalRow)
}

export async function countActiveSavingsGoals(userId) {
  if (!(await tableExists())) {
    return 0
  }

  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM savings_goals
     WHERE user_id = $1 AND active = true`,
    [userId]
  )

  return result.rows[0]?.count ?? 0
}

export async function createSavingsGoal(userId, body) {
  if (!(await tableExists())) {
    throw new Error('Savings goals are not available yet — run migration 012')
  }

  const parsed = parseCreateGoalInput(body)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const activeCount = await countActiveSavingsGoals(userId)
  if (activeCount >= MAX_ACTIVE_SAVINGS_GOALS) {
    const error = new Error(`You can have at most ${MAX_ACTIVE_SAVINGS_GOALS} active goals`)
    error.statusCode = 400
    throw error
  }

  const { name, purposeType, monthlyAmount, targetTotal } = parsed.value

  const result = await db.query(
    `INSERT INTO savings_goals (
       user_id, name, purpose_type, monthly_amount, target_total
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, name, purpose_type, monthly_amount, target_total,
               saved_so_far, active, created_at, updated_at`,
    [userId, name, purposeType, monthlyAmount, targetTotal]
  )

  return mapSavingsGoalRow(result.rows[0])
}

export async function updateSavingsGoal(userId, goalId, body) {
  if (!(await tableExists())) {
    throw new Error('Savings goals are not available yet — run migration 012')
  }

  const parsed = parseUpdateGoalInput(body)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.statusCode = 400
    throw error
  }

  const existing = await db.query(
    `SELECT id FROM savings_goals
     WHERE id = $1 AND user_id = $2 AND active = true`,
    [goalId, userId]
  )

  if (existing.rows.length === 0) {
    const error = new Error('Goal not found')
    error.statusCode = 404
    throw error
  }

  const updates = parsed.value
  const fields = []
  const values = [goalId, userId]
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
  if (updates.savedSoFar != null) {
    fields.push(`saved_so_far = $${paramIndex++}`)
    values.push(updates.savedSoFar)
  }

  fields.push('updated_at = NOW()')

  const result = await db.query(
    `UPDATE savings_goals
     SET ${fields.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, name, purpose_type, monthly_amount, target_total,
               saved_so_far, active, created_at, updated_at`,
    values
  )

  return mapSavingsGoalRow(result.rows[0])
}

export async function deleteSavingsGoal(userId, goalId) {
  if (!(await tableExists())) {
    throw new Error('Savings goals are not available yet — run migration 012')
  }

  const result = await db.query(
    `UPDATE savings_goals
     SET active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND active = true
     RETURNING id`,
    [goalId, userId]
  )

  if (result.rows.length === 0) {
    const error = new Error('Goal not found')
    error.statusCode = 404
    throw error
  }

  return { id: goalId }
}
