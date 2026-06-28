/*
 * CHAT ROUTES FILE
 *
 * Follow-up Q&A scoped to a single insight thread.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import { askFinancialQuestion } from '../services/claude.js'
import { loadFinancialContextForUser } from '../utils/financialContext.js'

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
    console.error('Failed to load chat messages:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/:insightId', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const { insightId } = req.params
    const { message } = req.body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const trimmedMessage = message.trim()

    const [insightResult, historyResult, { transactions, accountSummary }] =
      await Promise.all([
        db.query(
          `SELECT content FROM insights WHERE id = $1 AND user_id = $2`,
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
        loadFinancialContextForUser(userId),
      ])

    if (insightResult.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' })
    }

    await db.query(
      `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
       VALUES (gen_random_uuid(), $1, $2, 'user', $3)`,
      [userId, insightId, trimmedMessage]
    )

    const claudeResponseText = await askFinancialQuestion(
      insightResult.rows[0].content,
      historyResult.rows,
      trimmedMessage,
      transactions,
      accountSummary
    )

    await db.query(
      `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
       VALUES (gen_random_uuid(), $1, $2, 'assistant', $3)`,
      [userId, insightId, claudeResponseText]
    )

    res.json({ reply: claudeResponseText })
  } catch (err) {
    console.error('Failed to send chat message:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
