import db from '../db/index.js'
import { roundCurrency } from './safeToSpend.js'

export async function loadMonthlyBudget(userId) {
  const columnCheck = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'monthly_budget'`
  )

  if (columnCheck.rows.length === 0) {
    return null
  }

  const result = await db.query(
    `SELECT monthly_budget
     FROM users
     WHERE id = $1`,
    [userId]
  )

  if (result.rows.length === 0 || result.rows[0].monthly_budget == null) {
    return null
  }

  return roundCurrency(result.rows[0].monthly_budget)
}

export async function setMonthlyBudget(userId, monthlyBudget) {
  const columnCheck = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'monthly_budget'`
  )

  if (columnCheck.rows.length === 0) {
    throw new Error('Budget preferences are not available yet — run migration 011')
  }

  const result = await db.query(
    `UPDATE users
     SET monthly_budget = $2
     WHERE id = $1
     RETURNING monthly_budget`,
    [userId, monthlyBudget]
  )

  if (result.rows.length === 0) {
    throw new Error('User not found')
  }

  return roundCurrency(result.rows[0].monthly_budget)
}
