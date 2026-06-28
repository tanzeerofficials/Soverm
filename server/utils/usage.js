/*
 * USAGE UTIL
 *
 * Computes free-tier limits (1 insight/day, 7-day history) and streaks.
 * Pro users skip all limits — this is the single source of truth so
 * routes don't duplicate the "is this user gated?" logic.
 */

import db from '../db/index.js'

export const FREE_DAILY_INSIGHT_LIMIT = 1
export const FREE_HISTORY_DAYS = 7

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

/*
 * Streak = consecutive days (ending today or yesterday) with at least
 * one insight generated. Ending "yesterday" still counts so the streak
 * doesn't zero out the moment someone wakes up before generating today's.
 */
export async function getInsightStreak(userId) {
  const result = await db.query(
    `SELECT DISTINCT created_at::date AS day
     FROM insights
     WHERE user_id = $1
     ORDER BY day DESC
     LIMIT 60`,
    [userId]
  )

  const days = result.rows.map((row) => new Date(row.day))
  if (days.length === 0) {
    return 0
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const mostRecent = days[0]
  mostRecent.setHours(0, 0, 0, 0)
  const gapFromToday = Math.round((today - mostRecent) / ONE_DAY_MS)

  if (gapFromToday > 1) {
    return 0
  }

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]
    const curr = days[i]
    prev.setHours(0, 0, 0, 0)
    curr.setHours(0, 0, 0, 0)
    const gap = Math.round((prev - curr) / ONE_DAY_MS)

    if (gap === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export async function getUsageSummary(userId) {
  const tier = await getUserTier(userId)
  const isPro = tier === 'pro'
  const [generatedToday, streak] = await Promise.all([
    getInsightsGeneratedToday(userId),
    getInsightStreak(userId),
  ])

  const limit = isPro ? null : FREE_DAILY_INSIGHT_LIMIT
  const remainingToday = isPro ? null : Math.max(limit - generatedToday, 0)

  return {
    tier,
    isPro,
    generatedToday,
    limit,
    remainingToday,
    streak,
    historyDaysLimit: isPro ? null : FREE_HISTORY_DAYS,
  }
}
