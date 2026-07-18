/*
 * CATEGORY SOFT LIMITS SERVICE
 *
 * Optional per-category monthly targets. Independent from the overall spending cap.
 */

import db from '../db/index.js'
import {
  CONNECTED_ACCOUNT_TRANSACTION_JOINS,
  EXPENSE_ANALYZER_TRANSACTION_SELECT,
} from '../utils/connectedAccountTransactions.js'
import { calendarMonthSqlBounds } from '../utils/calendarMonth.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import { isCashFlowSpendingRow } from '../utils/cashFlowClassification.js'
import {
  canonicalizeSpendingCategoryLabel,
  resolveSpendingCategoryLabel,
} from '../utils/plaidCategory.js'
import { NON_PENDING_FILTER } from '../utils/transactionFilters.js'
import { invalidateChatFinancialSnapshot } from '../utils/chatFinancialSnapshotCache.js'

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
    category: canonicalizeSpendingCategoryLabel(row.category),
    monthlyLimit,
    alertWarningPercent: warningPercent,
    spentThisMonth: spentAmount,
    remaining,
    percentUsed,
    isWarning: percentUsed >= warningPercent && remaining >= 0,
    isOver: remaining < 0,
  }
}

/*
 * Match remapped spend to a stored soft-limit key, including Medical ↔ Healthcare aliases.
 */
function matchStoredCategoryKey(remapped, raw, categories) {
  const categorySet = new Set(categories)
  if (categorySet.has(remapped)) {
    return remapped
  }
  if (categorySet.has(raw)) {
    return raw
  }

  const remappedCanon = canonicalizeSpendingCategoryLabel(remapped)
  for (const stored of categories) {
    if (canonicalizeSpendingCategoryLabel(stored) === remappedCanon) {
      return stored
    }
  }

  return null
}

/*
 * Sum spend per soft-limit category using remapped labels + cash-flow classifier
 * so caps match what users see in Expenses / the month letter.
 */
async function loadSpentByCategory(userId, categories) {
  if (categories.length === 0) {
    return new Map()
  }

  const spent = new Map(categories.map((category) => [category, 0]))
  const { startIso, endExclusiveIso } = calendarMonthSqlBounds()
  const result = await db.query(
    `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date`,
    [userId, startIso, endExclusiveIso]
  )

  for (const row of result.rows) {
    if (!isCashFlowSpendingRow(row)) {
      continue
    }
    const remapped = resolveSpendingCategoryLabel(row)
    const raw = row.category || 'Uncategorized'
    const key = matchStoredCategoryKey(remapped, raw, categories)
    if (!key) {
      continue
    }
    spent.set(key, (spent.get(key) ?? 0) + Math.abs(Number(row.amount) || 0))
  }

  return new Map(
    [...spent.entries()].map(([category, amount]) => [category, roundCurrency(amount)])
  )
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

  const seenCanonical = new Set()
  const limits = []
  for (const row of result.rows) {
    const canonical = canonicalizeSpendingCategoryLabel(row.category)
    if (seenCanonical.has(canonical)) {
      continue
    }
    seenCanonical.add(canonical)
    limits.push(mapLimitRow(row, spentByCategory.get(row.category) ?? 0))
  }

  return limits
}

export async function upsertCategorySoftLimit(userId, { category, monthlyLimit, alertWarningPercent }) {
  if (!(await hasCategorySoftLimitsTable())) {
    const error = new Error('Category soft limits are not available yet')
    error.statusCode = 503
    throw error
  }

  const normalizedCategory = canonicalizeSpendingCategoryLabel(String(category || '').trim())
  const amount = Number(monthlyLimit)
  if (!normalizedCategory || normalizedCategory === 'Uncategorized' || !Number.isFinite(amount) || amount < 1) {
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

  const activeLimits = await db.query(
    `SELECT id, category
     FROM category_soft_limits
     WHERE user_id = $1 AND active = true`,
    [userId]
  )

  const matchingRows = activeLimits.rows.filter(
    (row) => canonicalizeSpendingCategoryLabel(row.category) === normalizedCategory
  )
  const primaryMatch = matchingRows[0] ?? null

  if (!primaryMatch && activeLimits.rows.length >= MAX_LIMITS_PER_USER) {
    const error = new Error(`You can set up to ${MAX_LIMITS_PER_USER} category limits`)
    error.statusCode = 400
    throw error
  }

  // Collapse duplicate alias rows (e.g. Medical + Healthcare) into one canonical key.
  if (matchingRows.length > 1) {
    const duplicateIds = matchingRows.slice(1).map((row) => row.id)
    await db.query(
      `UPDATE category_soft_limits
       SET active = false, updated_at = NOW()
       WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [userId, duplicateIds]
    )
  }

  let row
  if (primaryMatch) {
    const updated = await db.query(
      `UPDATE category_soft_limits
       SET category = $3,
           monthly_limit = $4,
           alert_warning_percent = $5,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, category, monthly_limit, alert_warning_percent`,
      [primaryMatch.id, userId, normalizedCategory, amount, warning]
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
  invalidateChatFinancialSnapshot(userId)
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

  if (result.rows.length > 0) {
    invalidateChatFinancialSnapshot(userId)
  }

  return { deleted: result.rows.length > 0 }
}
