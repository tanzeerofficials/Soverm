/*
 * USAGE UTIL
 *
 * Computes free-tier limits (1 insight/day, 7-day history).
 * Pro users skip all limits — this is the single source of truth so
 * routes don't duplicate the "is this user gated?" logic.
 */

import db from '../db/index.js'
import {
  FREE_DAILY_INSIGHT_LIMIT,
  FREE_HISTORY_DAYS,
} from '../shared/usageLimits.js'

export { FREE_DAILY_INSIGHT_LIMIT, FREE_HISTORY_DAYS } from '../shared/usageLimits.js'

export async function getUserTier(userId) {
  const result = await db.query(`SELECT subscription_tier FROM users WHERE id = $1`, [userId])
  return result.rows[0]?.subscription_tier ?? 'free'
}

export async function getInsightsGeneratedToday(userId) {
  const result = await db.query(
    `SELECT COUNT(*) AS count
     FROM insights
     WHERE user_id = $1
       AND created_at::date = NOW()::date`,
    [userId]
  )
  return Number(result.rows[0].count)
}

export async function getUsageSummary(userId) {
  const tier = await getUserTier(userId)
  const isPro = tier === 'pro'
  const generatedToday = await getInsightsGeneratedToday(userId)

  const limit = isPro ? null : FREE_DAILY_INSIGHT_LIMIT
  const remainingToday = isPro ? null : Math.max(limit - generatedToday, 0)

  return {
    tier,
    isPro,
    generatedToday,
    limit,
    remainingToday,
    historyDaysLimit: isPro ? null : FREE_HISTORY_DAYS,
  }
}

/**
 * Atomically checks whether a free-tier insight slot is still available today.
 *
 * What it does:
 * - Locks the users row (FOR UPDATE) so concurrent generates serialize
 * - Counts today's insights inside that lock
 * - Returns whether the caller may proceed, plus a usage snapshot
 *
 * Why we need it:
 * - A plain check-then-insert race lets two free-tier requests both pass
 *   when remainingToday === 1, burning an extra Claude call and storing
 *   two insights for a free user.
 *
 * How it fits the app:
 * - POST /api/insights/generate calls this before Claude (fast reject) and
 *   again under lock right before INSERT so a parallel request that finished
 *   while Claude was running cannot push a free user over the daily limit.
 *
 * Important: keep the lock only around the check/insert — never across the
 * Claude API call (that can take seconds and would block other user requests).
 *
 * @param {import('pg').PoolClient} client - open transaction client
 * @param {string} userId
 */
export async function reserveFreeInsightSlot(client, userId) {
  const tierResult = await client.query(
    `SELECT subscription_tier
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  )

  const tier = tierResult.rows[0]?.subscription_tier ?? 'free'
  const isPro = tier === 'pro'

  const countResult = await client.query(
    `SELECT COUNT(*) AS count
     FROM insights
     WHERE user_id = $1
       AND created_at::date = NOW()::date`,
    [userId]
  )
  const generatedToday = Number(countResult.rows[0].count)

  if (isPro) {
    return {
      allowed: true,
      usage: {
        tier,
        isPro: true,
        generatedToday,
        limit: null,
        remainingToday: null,
        historyDaysLimit: null,
      },
    }
  }

  const limit = FREE_DAILY_INSIGHT_LIMIT
  const remainingToday = Math.max(limit - generatedToday, 0)

  return {
    allowed: remainingToday > 0,
    usage: {
      tier,
      isPro: false,
      generatedToday,
      limit,
      remainingToday,
      historyDaysLimit: FREE_HISTORY_DAYS,
    },
  }
}

export const TRACKER_PRO_REQUIRED_MESSAGE =
  'Savings goals and custom alerts are included with Soverm Pro.'

export const TRACKER_SAVINGS_PRO_MESSAGE =
  'Savings goals are included with Soverm Pro. Free includes one spending cap.'

export const TRACKER_ALERTS_PRO_MESSAGE =
  'Custom spending alerts are included with Soverm Pro.'

function proRequiredError(message) {
  const error = new Error(message)
  error.statusCode = 403
  error.code = 'pro_required'
  return error
}

/*
 * What it does: throws a 403 if the user is not on Pro.
 * Why: true Pro-only paths (e.g. savings detections) must not be callable from Free.
 */
export async function assertProTier(userId) {
  const tier = await getUserTier(userId)
  if (tier !== 'pro') {
    throw proRequiredError(TRACKER_PRO_REQUIRED_MESSAGE)
  }
}

function bodyTouchesAlertFields(body) {
  if (!body || typeof body !== 'object') {
    return false
  }
  return (
    'alertWarningPercent' in body ||
    'alertRemainingDollars' in body ||
    body.alertWarningPercent != null ||
    body.alertRemainingDollars != null
  )
}

/*
 * Free: one spending cap (name + monthly amount). Pro: savings goals + custom alerts.
 */
export async function assertTrackerCreateAllowed(userId, body) {
  const tier = await getUserTier(userId)
  if (tier === 'pro') {
    return
  }

  const trackType = body?.trackType === 'saving' ? 'saving' : 'spending'
  if (trackType === 'saving') {
    throw proRequiredError(TRACKER_SAVINGS_PRO_MESSAGE)
  }
  if (bodyTouchesAlertFields(body)) {
    throw proRequiredError(TRACKER_ALERTS_PRO_MESSAGE)
  }
}

export async function assertTrackerUpdateAllowed(userId, trackType, body) {
  const tier = await getUserTier(userId)
  if (tier === 'pro') {
    return
  }

  if (trackType === 'saving') {
    throw proRequiredError(TRACKER_SAVINGS_PRO_MESSAGE)
  }
  if (bodyTouchesAlertFields(body)) {
    throw proRequiredError(TRACKER_ALERTS_PRO_MESSAGE)
  }
}

export async function assertTrackerDeleteAllowed(userId, trackType) {
  const tier = await getUserTier(userId)
  if (tier === 'pro') {
    return
  }

  if (trackType === 'saving') {
    throw proRequiredError(TRACKER_SAVINGS_PRO_MESSAGE)
  }
}
