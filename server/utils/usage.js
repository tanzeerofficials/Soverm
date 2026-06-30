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
} from '../../shared/usageLimits.js'

export { FREE_DAILY_INSIGHT_LIMIT, FREE_HISTORY_DAYS } from '../../shared/usageLimits.js'

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
