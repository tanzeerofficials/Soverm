/*
 * INSIGHTS ROUTES FILE
 *
 * These routes generate and store AI financial summaries
 * for logged-in users based on their transactions and balances.
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import db from '../db/index.js'
import { generateFinancialSummary } from '../services/claude.js'
import { loadFinancialContextForUser } from '../utils/financialContext.js'
import { getUsageSummary } from '../utils/usage.js'
import {
  getGenerateRateLimitMessage,
  isGenerateRateLimited,
  PRO_DAILY_INSIGHT_CEILING,
} from '../utils/rateLimit.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

/*
 * GET /api/insights/usage
 *
 * What it does:
 * - Reports today's free-tier usage (generated/remaining) and tier
 *
 * Why we need it:
 * - Dashboard shows a "1 insight remaining today" badge
 *   without guessing — this is the single source of truth for limits
 */
router.get('/usage', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const usage = await getUsageSummary(userId)
    res.json(usage)
  } catch (err) {
    reportServerError('to load usage summary', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * POST /api/insights/generate
 *
 * What it does:
 * - Loads recent transactions and account balances
 * - Asks Claude for a plain-English financial summary
 * - Saves the summary to the insights table and returns it
 *
 * Why we need it:
 * - Users want AI advice without re-calling Claude every page load
 *
 * How it fits the app:
 * - Dashboard calls this after syncing transactions to refresh insights
 * - Free tier is capped at 1 insight/day; Pro is unlimited. Limit is
 *   checked first so we never spend a Claude call we're about to reject
 */
router.post('/generate', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const usage = await getUsageSummary(userId)

    if (!usage.isPro && usage.remainingToday <= 0) {
      return res.status(403).json({
        error: 'limit_reached',
        message:
          "You've used today's free insight. Upgrade to Soverm Pro for unlimited insights.",
        usage,
      })
    }

    if (isGenerateRateLimited(usage)) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: getGenerateRateLimitMessage(),
        limit: PRO_DAILY_INSIGHT_CEILING,
        usage,
      })
    }

    const { transactions, accountSummary } = await loadFinancialContextForUser(userId)

    const claudeResponse = await generateFinancialSummary(transactions, accountSummary)

    const insightResult = await db.query(
      `INSERT INTO insights (id, user_id, type, content)
       VALUES (gen_random_uuid(), $1, 'weekly_summary', $2)
       RETURNING id`,
      [userId, JSON.stringify(claudeResponse)]
    )

    const insightId = insightResult.rows[0].id
    const actionIds = []

    for (const actionText of claudeResponse.actions ?? []) {
      const actionResult = await db.query(
        `INSERT INTO actions (id, user_id, insight_id, description)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        [userId, insightId, actionText]
      )
      actionIds.push(actionResult.rows[0].id)
    }

    const updatedUsage = await getUsageSummary(userId)

    res.json({
      success: true,
      insight: claudeResponse,
      insightId,
      actionIds,
      usage: updatedUsage,
    })
  } catch (err) {
    reportServerError('to generate insight', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
