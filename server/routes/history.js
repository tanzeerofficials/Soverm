/*
 * HISTORY ROUTES FILE
 *
 * Returns past insights with their related action items.
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import db from '../db/index.js'
import { getUsageSummary } from '../utils/usage.js'

const router = Router()

function parseInsightContent(row) {
  let parsedContent

  try {
    parsedContent = JSON.parse(row.content)
  } catch {
    parsedContent = {
      headline: 'Previous insight',
      fullSummary: row.content,
      stats: [],
    }
  }

  return { ...parsedContent, id: row.id, created_at: row.created_at }
}

/*
 * GET /api/history
 *
 * What it does:
 * - Loads insights for the user, parses stored JSON content
 * - Loads all actions and attaches them to the matching insight
 * - Free tier only gets the last 7 days; Pro gets everything.
 *   We still report how many older insights exist (lockedCount) so the
 *   UI can show "+12 more insights" rather than just cutting off silently
 *
 * Why two queries + JavaScript matching:
 * - Easier to read than one nested SQL JOIN for beginners
 */
router.get('/', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const usage = await getUsageSummary(userId)
    const historyInterval = usage.historyDaysLimit === null ? null : `${usage.historyDaysLimit} days`

    const insightsResult =
      historyInterval === null
        ? await db.query(
            `SELECT id, content, created_at
             FROM insights
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
          )
        : await db.query(
            `SELECT id, content, created_at
             FROM insights
             WHERE user_id = $1
               AND created_at >= NOW() - $2::interval
             ORDER BY created_at DESC`,
            [userId, historyInterval]
          )

    let lockedCount = 0
    if (historyInterval !== null) {
      const lockedResult = await db.query(
        `SELECT COUNT(*) AS count
         FROM insights
         WHERE user_id = $1
           AND created_at < NOW() - $2::interval`,
        [userId, historyInterval]
      )
      lockedCount = Number(lockedResult.rows[0].count)
    }

    const actionsResult = await db.query(
      `SELECT id, insight_id, description, completed
       FROM actions
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    )

    const actionsByInsightId = {}

    for (const action of actionsResult.rows) {
      if (!actionsByInsightId[action.insight_id]) {
        actionsByInsightId[action.insight_id] = []
      }
      actionsByInsightId[action.insight_id].push({
        id: action.id,
        description: action.description,
        completed: action.completed,
      })
    }

    const insights = insightsResult.rows.map((row) => ({
      ...parseInsightContent(row),
      actions: actionsByInsightId[row.id] ?? [],
    }))

    res.json({ insights, lockedCount, usage })
  } catch (err) {
    console.error('Failed to load insight history:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
