/*
 * CATEGORY SOFT LIMITS SERVICE
 *
 * Optional per-category monthly targets. Independent from the overall spending cap.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { calendarMonthSqlBounds } from '../utils/calendarMonth.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
} from '../utils/transactionFilters.js'

const MAX_LIMITS_PER_USER = 5

let tableCache = null
let tableCheckedAt = 0
const TABLE_CACHE_TTL_MS = 60_000

export async function hasCategorySoftLimitsTable() {
  if (tableCache !== null && Date.now() - tableCheckedAt < TABLE_CACHE_TTL_MS) {
    return tableCache
  }

  const result = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'category_soft_limits'`
  )
  tableCache = result.rows.length > 0
  tableCheckedAt = Date.now()
  return tableCache
}

function mapLimitRow(row, spent = 0) {
  const monthlyLimit = roundCurrency(row.monthly_limit)
  const spentAmount = roundCurrency(spent)
  const remaining = roundCurrency(monthlyLimit - spentAmount)
  const percentUsed = monthlyLimit > 0 ? Math.round((spentAmount / monthlyLimit) * 100) : 0
  const warningPercent = Number(row.alert_warning_percent ?? 80)

  return {
    id: row.id,
    category: row.category,
    monthlyLimit,
    alertWarningPercent: warningPercent,
    spentThisMonth: spentAmount,
    remaining,
    percentUsed,
    isWarning: percentUsed >= warningPercent && remaining >= 0,
    isOver: remaining < 0,
  }
}

async function loadSpentByCategory(userId, categories) {
  if (categories.length === 0) {
    return new Map()
  }

  const { startIso, endExclusiveIso } = calendarMonthSqlBounds()
  const result = await db.query(
    `SELECT COALESCE(t.category, 'Uncategorized') AS category,
            COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spent
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date
       AND COALESCE(t.category, 'Uncategorized') = ANY($4::text[])
     GROUP BY 1`,
    [userId, startIso, endExclusiveIso, categories]
  )

  return new Map(result.rows.map((row) => [row.category, Number(row.spent)]))
}

export async function listCategorySoftLimits(userId) {
  if (!(await hasCategorySoftLimitsTable())) {
    return []
  }

  const result = await db.query(
    `SELECT id, category, monthly_limit, alert_warning_percent
     FROM category_soft_limits
     WHERE user_id = $1 AND active = true
     ORDER BY category ASC`,
    [userId]
  )

  const spentByCategory = await loadSpentByCategory(
    userId,
    result.rows.map((row) => row.category)
  )

  return result.rows.map((row) =>
    mapLimitRow(row, spentByCategory.get(row.category) ?? 0)
  )
}

export async function upsertCategorySoftLimit(userId, { category, monthlyLimit, alertWarningPercent }) {
  if (!(await hasCategorySoftLimitsTable())) {
    const error = new Error('Category soft limits are not available yet')
    error.statusCode = 503
    throw error
  }

  const normalizedCategory = String(category || '').trim()
  const amount = Number(monthlyLimit)
  if (!normalizedCategory || !Number.isFinite(amount) || amount < 1) {
    const error = new Error('category and monthlyLimit (>= 1) are required')
    error.statusCode = 400
    throw error
  }

  const warning = Number(alertWarningPercent ?? 80)
  if (!Number.isFinite(warning) || warning < 1 || warning > 99) {
    const error = new Error('alertWarningPercent must be between 1 and 99')
    error.statusCode = 400
    throw error
  }

  const existingCount = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM category_soft_limits
     WHERE user_id = $1 AND active = true`,
    [userId]
  )

  const existing = await db.query(
    `SELECT id
     FROM category_soft_limits
     WHERE user_id = $1 AND category = $2 AND active = true
     LIMIT 1`,
    [userId, normalizedCategory]
  )

  if (!existing.rows[0] && existingCount.rows[0].count >= MAX_LIMITS_PER_USER) {
    const error = new Error(`You can set up to ${MAX_LIMITS_PER_USER} category limits`)
    error.statusCode = 400
    throw error
  }

  let row
  if (existing.rows[0]) {
    const updated = await db.query(
      `UPDATE category_soft_limits
       SET monthly_limit = $3,
           alert_warning_percent = $4,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, category, monthly_limit, alert_warning_percent`,
      [existing.rows[0].id, userId, amount, warning]
    )
    row = updated.rows[0]
  } else {
    const inserted = await db.query(
      `INSERT INTO category_soft_limits (user_id, category, monthly_limit, alert_warning_percent)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, monthly_limit, alert_warning_percent`,
      [userId, normalizedCategory, amount, warning]
    )
    row = inserted.rows[0]
  }

  const spentByCategory = await loadSpentByCategory(userId, [normalizedCategory])
  return mapLimitRow(row, spentByCategory.get(normalizedCategory) ?? 0)
}

export async function deleteCategorySoftLimit(userId, limitId) {
  if (!(await hasCategorySoftLimitsTable())) {
    return { deleted: false }
  }

  const result = await db.query(
    `UPDATE category_soft_limits
     SET active = false, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND active = true
     RETURNING id`,
    [limitId, userId]
  )

  return { deleted: result.rows.length > 0 }
}
