import db from '../db/index.js'
import { calculateTotalBalance } from '../utils/balanceHelpers.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { loadMonthOverMonthComparison } from '../utils/financialContext.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import { normalizeMerchantName } from '../utils/merchantNormalize.js'
import {
  DEDUP_LOOKBACK_DAYS,
  evaluateProactiveTriggers,
  MAX_NOTIFICATIONS_PER_DAY,
  MAX_NOTIFICATIONS_PER_SYNC,
  MAX_PER_TRIGGER_TYPE_PER_DAY,
} from '../utils/proactiveNotificationRules.js'
import { generateProactiveNotificationCopy } from './proactiveNotificationCopy.js'
import { loadProactiveNotificationsEnabled } from '../utils/notificationPreferences.js'
import { listActiveTrackers } from './monthlyTrackersService.js'
import { enrichTracker } from '../utils/monthlyTrackers.js'
import { getCalendarMonthWindow } from '../utils/safeToSpend.js'
import { hasMonthlyTrackersTable } from '../utils/monthlyTrackersSchema.js'
import { loadSpentThisCalendarMonth } from './trackerSnapshot.js'
import { getAppTodaySqlParams } from '../utils/calendarMonth.js'

async function loadRecentTransactionsForTriggers(userId) {
  const result = await db.query(
    `SELECT t.id, t.name, t.amount, t.date, t.category,
            a.account_name, a.bank_name
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND (t.pending IS NOT TRUE)
       AND t.amount > 0
       AND t.date >= NOW() - INTERVAL '24 hours'
     ORDER BY t.amount DESC
     LIMIT 20`,
    [userId]
  )

  return result.rows
}

async function loadAccountsForUser(userId) {
  const result = await db.query(
    `SELECT bank_name, account_name, account_type, balance_current, balance_available
     FROM accounts
     WHERE user_id = $1`,
    [userId]
  )

  return result.rows
}

async function loadPreviouslyNotifiedRecurringMerchants(userId) {
  const result = await db.query(
    `SELECT related_data
     FROM notifications
     WHERE user_id = $1
       AND trigger_type = 'new_recurring_charge'`,
    [userId]
  )

  const merchants = new Set()

  for (const row of result.rows) {
    const merchantKey =
      row.related_data?.merchantKey ??
      normalizeMerchantName(row.related_data?.merchant ?? '')

    if (merchantKey) {
      merchants.add(merchantKey)
    }
  }

  return merchants
}

async function loadNotificationLimits(userId) {
  const { todayIso, tomorrowIso, timeZone } = getAppTodaySqlParams()
  const [todayResult, dedupResult] = await Promise.all([
    db.query(
      `SELECT trigger_type, COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1
         AND created_at >= ($2::timestamp AT TIME ZONE $3)
         AND created_at < ($4::timestamp AT TIME ZONE $3)
       GROUP BY trigger_type`,
      [userId, todayIso, timeZone, tomorrowIso]
    ),
    db.query(
      `SELECT trigger_type, dedup_key
       FROM notifications
       WHERE user_id = $1
         AND created_at >= NOW() - ($2::text || ' days')::interval`,
      [userId, String(DEDUP_LOOKBACK_DAYS)]
    ),
  ])

  const createdToday = todayResult.rows.reduce((sum, row) => sum + row.count, 0)
  const triggerTypeCountsToday = Object.fromEntries(
    todayResult.rows.map((row) => [row.trigger_type, row.count])
  )
  const recentDedupKeys = new Set(
    dedupResult.rows.map((row) => `${row.trigger_type}:${row.dedup_key}`)
  )

  return { createdToday, triggerTypeCountsToday, recentDedupKeys }
}

async function loadSpendingTrackerForTriggers(userId) {
  if (!(await hasMonthlyTrackersTable())) {
    return { spendingTracker: null, periodStart: null }
  }

  const [spentThisMonth, trackers] = await Promise.all([
    loadSpentThisCalendarMonth(userId),
    listActiveTrackers(userId),
  ])

  const spending = trackers.find((tracker) => tracker.trackType === 'spending')

  if (!spending) {
    return { spendingTracker: null, periodStart: null }
  }

  return {
    spendingTracker: enrichTracker(spending, { spentThisMonth }),
    periodStart: getCalendarMonthWindow().periodStart,
  }
}

async function buildEvaluationContext(userId) {
  const [
    accounts,
    monthOverMonth,
    expensePayload,
    recentTransactions,
    previouslyNotifiedMerchants,
    spendingTrackerContext,
  ] = await Promise.all([
    loadAccountsForUser(userId),
    loadMonthOverMonthComparison(userId),
    loadExpenseAnalyzerData(userId),
    loadRecentTransactionsForTriggers(userId),
    loadPreviouslyNotifiedRecurringMerchants(userId),
    loadSpendingTrackerForTriggers(userId),
  ])

  return {
    accounts,
    monthOverMonth,
    categoryBreakdown: expensePayload.categoryBreakdown ?? [],
    recurringCharges: expensePayload.recurringCharges ?? [],
    recentTransactions,
    previouslyNotifiedMerchants,
    netBalance: calculateTotalBalance(accounts),
    spendingTracker: spendingTrackerContext.spendingTracker,
    periodStart: spendingTrackerContext.periodStart,
  }
}

function shouldSkipTrigger(trigger, limits) {
  if (limits.createdToday >= MAX_NOTIFICATIONS_PER_DAY) {
    return true
  }

  const typeCountToday = limits.triggerTypeCountsToday[trigger.triggerType] ?? 0

  if (typeCountToday >= MAX_PER_TRIGGER_TYPE_PER_DAY) {
    return true
  }

  if (limits.recentDedupKeys.has(`${trigger.triggerType}:${trigger.dedupKey}`)) {
    return true
  }

  return false
}

async function insertNotification(userId, trigger, copy) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (
         id, user_id, trigger_type, title, body, related_data, dedup_key
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, trigger_type, dedup_key)
         WHERE dedup_key IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [
        userId,
        trigger.triggerType,
        copy.title,
        copy.body,
        JSON.stringify(trigger.relatedData),
        trigger.dedupKey,
      ]
    )
    return { created: result.rows.length > 0 }
  } catch (err) {
    // Unique violation if migration 026 index exists but ON CONFLICT target
    // could not be inferred — treat as already delivered.
    if (err.code === '23505') {
      return { created: false, reason: 'already_exists' }
    }
    // Index missing — fall back to plain insert (pre-026 environments).
    if (err.code === '42P10' || /no unique|ON CONFLICT/i.test(err.message)) {
      await db.query(
        `INSERT INTO notifications (
           id, user_id, trigger_type, title, body, related_data, dedup_key
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [
          userId,
          trigger.triggerType,
          copy.title,
          copy.body,
          JSON.stringify(trigger.relatedData),
          trigger.dedupKey,
        ]
      )
      return { created: true }
    }
    throw err
  }
}

/*
 * evaluateAndCreateProactiveNotifications(userId)
 *
 * Runs deterministic trigger checks after sync. Claude only writes copy.
 */
export async function evaluateAndCreateProactiveNotifications(userId) {
  try {
    const tableCheck = await db.query(
      `SELECT to_regclass('public.notifications') AS table_name`
    )

    if (!tableCheck.rows[0]?.table_name) {
      return { created: 0, skipped: 'notifications_table_missing' }
    }

    const proactiveEnabled = await loadProactiveNotificationsEnabled(userId)

    if (!proactiveEnabled) {
      return { created: 0, skipped: 'proactive_notifications_disabled' }
    }

    const [context, limits] = await Promise.all([
      buildEvaluationContext(userId),
      loadNotificationLimits(userId),
    ])

    const candidates = evaluateProactiveTriggers(context)
    let created = 0

    for (const trigger of candidates) {
      if (created >= MAX_NOTIFICATIONS_PER_SYNC) {
        break
      }

      if (shouldSkipTrigger(trigger, limits)) {
        continue
      }

      const copy = await generateProactiveNotificationCopy(trigger)
      const inserted = await insertNotification(userId, trigger, copy)
      if (!inserted.created) {
        limits.recentDedupKeys.add(`${trigger.triggerType}:${trigger.dedupKey}`)
        continue
      }

      limits.createdToday += 1
      limits.triggerTypeCountsToday[trigger.triggerType] =
        (limits.triggerTypeCountsToday[trigger.triggerType] ?? 0) + 1
      limits.recentDedupKeys.add(`${trigger.triggerType}:${trigger.dedupKey}`)
      created += 1
    }

    return { created }
  } catch (err) {
    console.error(`Proactive notifications failed for user ${userId}:`, err.message)
    return { created: 0, error: err.message }
  }
}

export async function listNotificationsForUser(userId, { unreadOnly = false, limit = 20 } = {}) {
  const result = await db.query(
    `SELECT id, trigger_type, title, body, related_data, read, created_at
     FROM notifications
     WHERE user_id = $1
       ${unreadOnly ? 'AND read = false' : ''}
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows
}

export async function countUnreadNotifications(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE user_id = $1 AND read = false`,
    [userId]
  )

  return result.rows[0]?.count ?? 0
}

export async function markNotificationRead(userId, notificationId) {
  const result = await db.query(
    `UPDATE notifications
     SET read = true
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  )

  return result.rows.length > 0
}

export async function markAllNotificationsRead(userId) {
  await db.query(
    `UPDATE notifications
     SET read = true
     WHERE user_id = $1 AND read = false`,
    [userId]
  )
}
