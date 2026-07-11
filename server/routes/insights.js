/*
 * INSIGHTS ROUTES FILE
 *
 * These routes generate and store AI financial summaries
 * for logged-in users based on their transactions and balances.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import { generateFinancialSummary, buildPersistedInsightContent } from '../services/claude.js'
import { loadFinancialContextForUser, loadMonthOverMonthComparison } from '../utils/financialContext.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import { getUsageSummary, reserveFreeInsightSlot } from '../utils/usage.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import {
  getGenerateRateLimitMessage,
  isGenerateRateLimited,
} from '../utils/rateLimit.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

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
 * - Reserves a free-tier insight slot under a DB lock (race-safe)
 * - Loads recent connected-account transactions and balances
 * - Asks Claude for a plain-English financial summary
 * - Saves the summary + actions in one transaction
 *
 * Why we need it:
 * - Users want AI advice without re-calling Claude every page load
 *
 * How it fits the app:
 * - Dashboard calls this after syncing transactions to refresh insights
 * - Free tier is capped at 1 insight/day; Pro is unlimited. The slot is
 *   reserved before Claude so concurrent free requests cannot both pass.
 */
router.post('/generate', async (req, res) => {
  const { userId } = getAuth(req)
  const client = await db.connect()

  try {
    await ensureUserExists(userId)

    await client.query('BEGIN')

    const reservation = await reserveFreeInsightSlot(client, userId)

    if (!reservation.allowed) {
      await client.query('ROLLBACK')
      return res.status(403).json({
        error: 'limit_reached',
        message:
          "You've used today's free insight. Upgrade to Soverm Pro for unlimited insights.",
        usage: reservation.usage,
      })
    }

    if (isGenerateRateLimited(reservation.usage)) {
      await client.query('ROLLBACK')
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: getGenerateRateLimitMessage(),
      })
    }

    // Hold the user-row lock only for the quota check. Claude can take seconds;
    // keeping FOR UPDATE open that long would block other requests for this user.
    await client.query('COMMIT')

    const [
      { transactions, accountSummary },
      monthOverMonthComparison,
      expenseAnalyzerContext,
    ] = await Promise.all([
      loadFinancialContextForUser(userId),
      loadMonthOverMonthComparison(userId),
      loadExpenseAnalyzerData(userId),
    ])

    const claudeResponse = await generateFinancialSummary(
      transactions,
      accountSummary,
      monthOverMonthComparison,
      expenseAnalyzerContext
    )

    const persistedInsight = buildPersistedInsightContent(
      claudeResponse,
      monthOverMonthComparison,
      { transactionCount: transactions.length }
    )

    await client.query('BEGIN')

    // Re-check under lock after Claude so a parallel request that finished
    // while we were waiting cannot push a free user over the daily limit.
    const postClaudeReservation = await reserveFreeInsightSlot(client, userId)
    if (!postClaudeReservation.allowed) {
      await client.query('ROLLBACK')
      return res.status(403).json({
        error: 'limit_reached',
        message:
          "You've used today's free insight. Upgrade to Soverm Pro for unlimited insights.",
        usage: postClaudeReservation.usage,
      })
    }

    const insightResult = await client.query(
      `INSERT INTO insights (id, user_id, type, content)
       VALUES (gen_random_uuid(), $1, 'weekly_summary', $2)
       RETURNING id`,
      [userId, JSON.stringify(persistedInsight)]
    )

    const insightId = insightResult.rows[0].id
    const actionIds = []

    for (const actionText of persistedInsight.actions ?? []) {
      const actionResult = await client.query(
        `INSERT INTO actions (id, user_id, insight_id, description)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        [userId, insightId, actionText]
      )
      actionIds.push(actionResult.rows[0].id)
    }

    await client.query('COMMIT')

    const updatedUsage = await getUsageSummary(userId)

    res.json({
      success: true,
      insight: persistedInsight,
      insightId,
      actionIds,
      usage: updatedUsage,
    })
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Transaction may already be closed.
    }
    reportServerError('to generate insight', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  } finally {
    client.release()
  }
})

export default router
