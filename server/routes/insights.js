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
import { getDisplayBalance } from '../utils/balanceHelpers.js'

const router = Router()

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
 */
router.post('/generate', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const transactionsResult = await db.query(
      `SELECT t.*,
              a.bank_name,
              COALESCE(a.account_name, 'Disconnected account') AS account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = $1
       ORDER BY t.date DESC
       LIMIT 50`,
      [userId]
    )

    const accountsResult = await db.query(
      `SELECT account_name, account_type, balance_current, balance_available
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    )

    const accountSummary = accountsResult.rows
      .map(
        (a) =>
          `${a.account_name} (${a.account_type}): $${getDisplayBalance(a)}`
      )
      .join('\n')

    const claudeResponse = await generateFinancialSummary(
      transactionsResult.rows,
      accountSummary
    )

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

    res.json({ success: true, insight: claudeResponse, actionIds })
  } catch (err) {
    console.error('Failed to generate insight:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
