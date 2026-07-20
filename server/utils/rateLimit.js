/*
 * RATE LIMIT UTIL
 *
 * Per-user limits keyed on Clerk userId (not IP). Chat counts come from Postgres
 * so limits stay consistent if Railway runs multiple server instances.
 *
 * Free tier: daily message cap. Pro: rolling hourly cap.
 */

import { getAuth } from '@clerk/express'
import db from '../db/index.js'
import {
  CHAT_HOURLY_LIMIT,
  FREE_DAILY_CHAT_LIMIT,
  PRO_DAILY_INSIGHT_CEILING,
} from '../shared/usageLimits.js'
import { getUserTier } from './usage.js'
import { reportServerError } from './sentry.js'
import {
  getAppTodaySqlParams,
  getSecondsUntilAppTomorrow,
} from './calendarMonth.js'

export {
  CHAT_HOURLY_LIMIT,
  FREE_DAILY_CHAT_LIMIT,
  PRO_DAILY_INSIGHT_CEILING,
}

function rateLimitResponse(res, { message, status = null }) {
  return res.status(429).json({
    error: 'rate_limit_exceeded',
    message,
    ...(status
      ? {
          remaining: status.remaining,
          limit: status.limit,
          count: status.count,
          period: status.period,
          retryAfterSeconds: status.retryAfterSeconds,
        }
      : {}),
  })
}

export async function getChatMessagesInLastHour(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM chat_messages
     WHERE user_id = $1
       AND role = 'user'
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  )
  return result.rows[0].count
}

export async function getChatMessagesToday(userId) {
  const { todayIso, tomorrowIso, timeZone } = getAppTodaySqlParams()
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM chat_messages
     WHERE user_id = $1
       AND role = 'user'
       AND created_at >= ($2::timestamp AT TIME ZONE $3)
       AND created_at < ($4::timestamp AT TIME ZONE $3)`,
    [userId, todayIso, timeZone, tomorrowIso]
  )
  return result.rows[0].count
}

function getSecondsUntilTomorrow() {
  return getSecondsUntilAppTomorrow()
}

async function buildHourlyChatLimitStatus(userId) {
  const count = await getChatMessagesInLastHour(userId)
  const limit = CHAT_HOURLY_LIMIT
  const remaining = Math.max(limit - count, 0)
  const allowed = count < limit

  let retryAfterSeconds = null
  if (!allowed) {
    const oldest = await db.query(
      `SELECT EXTRACT(EPOCH FROM (created_at + INTERVAL '1 hour' - NOW()))::int AS seconds
       FROM chat_messages
       WHERE user_id = $1
         AND role = 'user'
         AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    )
    retryAfterSeconds = Math.max(oldest.rows[0]?.seconds ?? 60, 1)
  }

  return {
    allowed,
    count,
    limit,
    remaining,
    period: 'hour',
    retryAfterSeconds,
    message: allowed
      ? null
      : 'Message limit reached for this hour. Try again in a few minutes.',
  }
}

async function buildDailyChatLimitStatus(userId) {
  const count = await getChatMessagesToday(userId)
  const limit = FREE_DAILY_CHAT_LIMIT
  const remaining = Math.max(limit - count, 0)
  const allowed = count < limit

  return {
    allowed,
    count,
    limit,
    remaining,
    period: 'day',
    retryAfterSeconds: allowed ? null : getSecondsUntilTomorrow(),
    message: allowed
      ? null
      : 'Daily message limit reached. Try again tomorrow.',
  }
}

export async function getChatRateLimitStatus(userId) {
  const tier = await getUserTier(userId)
  if (tier === 'pro') {
    return buildHourlyChatLimitStatus(userId)
  }
  return buildDailyChatLimitStatus(userId)
}

/*
 * What this does: under a user-row lock, checks whether another chat message
 * is allowed right now (free daily / Pro hourly).
 *
 * Why: the Express middleware check alone is not atomic — two parallel
 * requests can both pass COUNT and both call Claude. Callers reserve before
 * the model call and re-check before persist (same pattern as insights).
 *
 * @param {import('pg').PoolClient} client - open transaction client
 * @param {string} userId
 */
export async function reserveChatSlot(client, userId) {
  const tierResult = await client.query(
    `SELECT subscription_tier
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  )

  const tier = tierResult.rows[0]?.subscription_tier ?? 'free'
  const isPro = tier === 'pro'

  if (isPro) {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages
       WHERE user_id = $1
         AND role = 'user'
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    )
    const count = Number(countResult.rows[0].count)
    const limit = CHAT_HOURLY_LIMIT
    const remaining = Math.max(limit - count, 0)
    const allowed = count < limit

    let retryAfterSeconds = null
    if (!allowed) {
      const oldest = await client.query(
        `SELECT EXTRACT(EPOCH FROM (created_at + INTERVAL '1 hour' - NOW()))::int AS seconds
         FROM chat_messages
         WHERE user_id = $1
           AND role = 'user'
           AND created_at > NOW() - INTERVAL '1 hour'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
      )
      retryAfterSeconds = Math.max(oldest.rows[0]?.seconds ?? 60, 1)
    }

    return {
      allowed,
      status: {
        allowed,
        count,
        limit,
        remaining,
        period: 'hour',
        retryAfterSeconds,
        message: allowed
          ? null
          : 'Message limit reached for this hour. Try again in a few minutes.',
      },
    }
  }

  const { todayIso, tomorrowIso, timeZone } = getAppTodaySqlParams()
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM chat_messages
     WHERE user_id = $1
       AND role = 'user'
       AND created_at >= ($2::timestamp AT TIME ZONE $3)
       AND created_at < ($4::timestamp AT TIME ZONE $3)`,
    [userId, todayIso, timeZone, tomorrowIso]
  )
  const count = Number(countResult.rows[0].count)
  const limit = FREE_DAILY_CHAT_LIMIT
  const remaining = Math.max(limit - count, 0)
  const allowed = count < limit

  let retryAfterSeconds = null
  if (!allowed) {
    retryAfterSeconds = getSecondsUntilAppTomorrow()
  }

  return {
    allowed,
    status: {
      allowed,
      count,
      limit,
      remaining,
      period: 'day',
      retryAfterSeconds,
      message: allowed ? null : 'Daily message limit reached. Try again tomorrow.',
    },
  }
}

export function isGenerateRateLimited(usage) {
  return usage.generatedToday >= PRO_DAILY_INSIGHT_CEILING
}

export function getGenerateRateLimitMessage() {
  return 'Daily insight limit reached. Try again tomorrow.'
}

/*
 * Express middleware — call after requireAuth() so getAuth(req).userId is set.
 */
export function chatRateLimitMiddleware() {
  return async (req, res, next) => {
    const { userId } = getAuth(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
      const status = await getChatRateLimitStatus(userId)
      if (!status.allowed) {
        return rateLimitResponse(res, {
          message: status.message,
          status,
        })
      }
      next()
    } catch (err) {
      reportServerError('chat rate limit check', err, { userId, req })
      next(err)
    }
  }
}
