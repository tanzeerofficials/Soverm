/*
 * RATE LIMIT UTIL
 *
 * Per-user limits keyed on Clerk userId (not IP). Chat counts come from Postgres
 * so limits stay consistent if Railway runs multiple server instances.
 */

import { getAuth } from '@clerk/express'
import db from '../db/index.js'
import {
  CHAT_HOURLY_LIMIT,
  PRO_DAILY_INSIGHT_CEILING,
} from '../shared/usageLimits.js'
import { reportServerError } from './sentry.js'

export { CHAT_HOURLY_LIMIT, PRO_DAILY_INSIGHT_CEILING }

function rateLimitResponse(res, { message }) {
  return res.status(429).json({
    error: 'rate_limit_exceeded',
    message,
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

export async function getChatRateLimitStatus(userId) {
  const count = await getChatMessagesInLastHour(userId)
  const remaining = Math.max(CHAT_HOURLY_LIMIT - count, 0)
  const allowed = count < CHAT_HOURLY_LIMIT

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
    limit: CHAT_HOURLY_LIMIT,
    remaining,
    retryAfterSeconds,
    message: allowed
      ? null
      : 'Message limit reached for this hour. Try again in a few minutes.',
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
        })
      }
      next()
    } catch (err) {
      reportServerError('chat rate limit check', err, { userId, req })
      next(err)
    }
  }
}
