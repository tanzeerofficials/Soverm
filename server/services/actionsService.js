/*
 * ACTIONS SERVICE
 *
 * Closed-loop lifecycle: suggested → accepted → done / skipped / dismissed.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { getCalendarWeekWindow } from '../utils/calendarWeek.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import {
  ACTION_STATUSES,
  mapStatusToCompleted,
  verifyActionOutcome,
} from '../utils/actionOutcomes.js'
import {
  EXCLUDE_INTERNAL_MOVES_FILTER,
  NON_PENDING_FILTER,
} from '../utils/transactionFilters.js'
import { invalidateChatFinancialSnapshot } from '../utils/chatFinancialSnapshotCache.js'

let lifecycleCache = null
let lifecycleCheckedAt = 0

export async function hasActionLifecycleColumns() {
  if (lifecycleCache !== null && Date.now() - lifecycleCheckedAt < 60_000) {
    return lifecycleCache
  }
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'actions' AND column_name = 'status'`
  )
  lifecycleCache = result.rows.length > 0
  lifecycleCheckedAt = Date.now()
  return lifecycleCache
}

function mapActionRow(row) {
  const status = row.status ?? (row.completed ? 'done' : 'suggested')
  return {
    id: row.id,
    description: row.description,
    completed: Boolean(row.completed) || status === 'done',
    status,
    source: row.source ?? 'insight',
    weekStartOn: row.week_start_on ? String(row.week_start_on).slice(0, 10) : null,
    metadata: row.metadata ?? {},
    outcomeSummary: row.outcome_summary ?? null,
    insightId: row.insight_id ?? null,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
    resolvedAt: row.resolved_at ?? null,
  }
}

export async function listRecentActions(userId, { limit = 20 } = {}) {
  const hasLifecycle = await hasActionLifecycleColumns()
  const result = hasLifecycle
    ? await db.query(
        `SELECT id, description, completed, created_at, insight_id,
                status, source, week_start_on, metadata, outcome_summary,
                accepted_at, resolved_at
         FROM actions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      )
    : await db.query(
        `SELECT id, description, completed, created_at, insight_id
         FROM actions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      )

  return result.rows.map(mapActionRow)
}

export async function createAction(
  userId,
  {
    description,
    source = 'weekly',
    status = 'accepted',
    weekStartOn = null,
    metadata = {},
    insightId = null,
  } = {}
) {
  const text = String(description || '').trim()
  if (!text) {
    const error = new Error('description is required')
    error.statusCode = 400
    throw error
  }

  if (!ACTION_STATUSES.includes(status)) {
    const error = new Error('invalid status')
    error.statusCode = 400
    throw error
  }

  const hasLifecycle = await hasActionLifecycleColumns()
  const completed = mapStatusToCompleted(status)

  if (!hasLifecycle) {
    const result = await db.query(
      `INSERT INTO actions (user_id, insight_id, description, completed)
       VALUES ($1, $2, $3, $4)
       RETURNING id, description, completed, created_at, insight_id`,
      [userId, insightId, text, completed]
    )
    invalidateChatFinancialSnapshot(userId)
    return mapActionRow(result.rows[0])
  }

  const acceptedAt = status === 'accepted' || status === 'done' ? new Date() : null
  const resolvedAt = status === 'done' || status === 'skipped' || status === 'dismissed' ? new Date() : null

  const result = await db.query(
    `INSERT INTO actions (
       user_id, insight_id, description, completed,
       status, source, week_start_on, metadata, accepted_at, resolved_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::jsonb, $9, $10)
     RETURNING id, description, completed, created_at, insight_id,
               status, source, week_start_on, metadata, outcome_summary,
               accepted_at, resolved_at`,
    [
      userId,
      insightId,
      text,
      completed,
      status,
      source === 'insight' ? 'insight' : 'weekly',
      weekStartOn,
      JSON.stringify(metadata ?? {}),
      acceptedAt,
      resolvedAt,
    ]
  )

  invalidateChatFinancialSnapshot(userId)
  return mapActionRow(result.rows[0])
}

export async function updateActionStatus(userId, actionId, { status, completed } = {}) {
  const hasLifecycle = await hasActionLifecycleColumns()

  let nextStatus = status
  if (nextStatus == null && typeof completed === 'boolean') {
    const existing = await db.query(
      `SELECT status, completed FROM actions WHERE id = $1 AND user_id = $2`,
      [actionId, userId]
    )
    if (existing.rows.length === 0) {
      return null
    }
    const prev = existing.rows[0].status ?? (existing.rows[0].completed ? 'done' : 'suggested')
    nextStatus = completed ? 'done' : prev === 'done' ? 'accepted' : prev
  }

  if (nextStatus && !ACTION_STATUSES.includes(nextStatus)) {
    const error = new Error('invalid status')
    error.statusCode = 400
    throw error
  }

  const nextCompleted = mapStatusToCompleted(nextStatus)
  const resolvedAt =
    nextStatus === 'done' || nextStatus === 'skipped' || nextStatus === 'dismissed'
      ? new Date()
      : null
  const acceptedAt = nextStatus === 'accepted' || nextStatus === 'done' ? new Date() : null

  if (!hasLifecycle) {
    const result = await db.query(
      `UPDATE actions SET completed = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, description, completed, created_at, insight_id`,
      [nextCompleted, actionId, userId]
    )
    if (result.rows[0]) {
      invalidateChatFinancialSnapshot(userId)
      return mapActionRow(result.rows[0])
    }
    return null
  }

  const result = await db.query(
    `UPDATE actions
     SET status = $1,
         completed = $2,
         accepted_at = COALESCE($3, accepted_at),
         resolved_at = COALESCE($4, resolved_at)
     WHERE id = $5 AND user_id = $6
     RETURNING id, description, completed, created_at, insight_id,
               status, source, week_start_on, metadata, outcome_summary,
               accepted_at, resolved_at`,
    [nextStatus, nextCompleted, acceptedAt, resolvedAt, actionId, userId]
  )

  if (result.rows[0]) {
    invalidateChatFinancialSnapshot(userId)
    return mapActionRow(result.rows[0])
  }
  return null
}

async function sumCategorySpend(userId, category, startIso, endExclusiveIso) {
  if (!category) {
    return null
  }
  const result = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS spent
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND COALESCE(t.category, 'Uncategorized') = $2
       AND t.date >= $3::date
       AND t.date < $4::date`,
    [userId, category, startIso, endExclusiveIso]
  )
  return roundCurrency(result.rows[0].spent)
}

async function sumSpend(userId, startIso, endExclusiveIso) {
  const result = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS spent
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       ${EXCLUDE_INTERNAL_MOVES_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date`,
    [userId, startIso, endExclusiveIso]
  )
  return roundCurrency(result.rows[0].spent)
}

/**
 * Build A3 follow-ups for the prior week’s accepted/done/skipped actions.
 */
export async function buildWeeklyActionFollowUps(userId, { referenceDate = new Date() } = {}) {
  const hasLifecycle = await hasActionLifecycleColumns()
  if (!hasLifecycle) {
    return []
  }

  const week = getCalendarWeekWindow(referenceDate)
  const priorWeekStart = week.priorWeekStartIso
  const priorWeekEndExclusive = week.priorWeekEndExclusiveIso

  const result = await db.query(
    `SELECT id, description, completed, created_at, insight_id,
            status, source, week_start_on, metadata, outcome_summary,
            accepted_at, resolved_at
     FROM actions
     WHERE user_id = $1
       AND status IN ('accepted', 'done', 'skipped', 'dismissed')
       AND (
         week_start_on = $2::date
         OR (week_start_on IS NULL AND created_at::date >= $2::date AND created_at::date < $3::date)
       )
     ORDER BY created_at DESC
     LIMIT 8`,
    [userId, priorWeekStart, priorWeekEndExclusive]
  )

  if (result.rows.length === 0) {
    return []
  }

  const spentThisWeek = await sumSpend(userId, week.weekStartIso, week.endExclusiveIso)
  const spentPriorWeek = await sumSpend(userId, priorWeekStart, priorWeekEndExclusive)

  const followUps = []
  for (const row of result.rows) {
    const action = mapActionRow(row)
    const category = action.metadata?.category ?? null
    const [categorySpendThisWeek, categorySpendPriorWeek] = await Promise.all([
      sumCategorySpend(userId, category, week.weekStartIso, week.endExclusiveIso),
      sumCategorySpend(userId, category, priorWeekStart, priorWeekEndExclusive),
    ])

    const outcome = verifyActionOutcome(action, {
      spentThisWeek,
      spentPriorWeek,
      categorySpendThisWeek,
      categorySpendPriorWeek,
    })

    followUps.push({
      actionId: action.id,
      description: action.description,
      status: action.status,
      source: action.source,
      ...outcome,
    })
  }

  return followUps
}
