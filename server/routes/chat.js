/*
 * CHAT ROUTES FILE
 *
 * Follow-up Q&A scoped to a single insight thread.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import { askFinancialQuestion, resolveInsightGeneratedAt } from '../services/claude.js'
import { chatRateLimitMiddleware } from '../utils/rateLimit.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

router.get('/:insightId', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const { insightId } = req.params

    const messagesResult = await db.query(
      `SELECT role, content, created_at
       FROM chat_messages
       WHERE insight_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [insightId, userId]
    )

    res.json({ messages: messagesResult.rows })
  } catch (err) {
    reportServerError('to load chat messages', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/:insightId', chatRateLimitMiddleware(), async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const { insightId } = req.params
    const { message } = req.body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const trimmedMessage = message.trim()

    const [insightResult, historyResult] = await Promise.all([
      db.query(
        `SELECT content, created_at FROM insights WHERE id = $1 AND user_id = $2`,
        [insightId, userId]
      ),
      db.query(
        `SELECT role, content
         FROM (
           SELECT role, content, created_at
           FROM chat_messages
           WHERE insight_id = $1 AND user_id = $2
           ORDER BY created_at DESC
           LIMIT 15
         ) recent
         ORDER BY created_at ASC`,
        [insightId, userId]
      ),
    ])

    if (insightResult.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' })
    }

    const insightRow = insightResult.rows[0]

    const claudeResponseText = await askFinancialQuestion(
      insightRow.content,
      historyResult.rows,
      trimmedMessage,
      {
        generatedAt: resolveInsightGeneratedAt(
          insightRow.content,
          insightRow.created_at
        ),
      }
    )

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
         VALUES (gen_random_uuid(), $1, $2, 'user', $3)`,
        [userId, insightId, trimmedMessage]
      )

      await client.query(
        `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
         VALUES (gen_random_uuid(), $1, $2, 'assistant', $3)`,
        [userId, insightId, claudeResponseText]
      )

      await client.query('COMMIT')
    } catch (dbErr) {
      await client.query('ROLLBACK')
      throw dbErr
    } finally {
      client.release()
    }

    res.json({ reply: claudeResponseText })
  } catch (err) {
    reportServerError('to send chat message', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
