/*
 * CHAT ROUTES FILE
 *
 * Follow-up Q&A scoped to a single insight thread.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import { askFinancialQuestion, resolveInsightGeneratedAt } from '../services/claude.js'
import { loadChatFinancialContext, loadInsightActionsForChat } from '../utils/chatFinancialContext.js'
import { chatRateLimitMiddleware } from '../utils/rateLimit.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { validateChatMessage, validateUuidParam } from '../utils/validation.js'

const router = Router()

router.use(requireAuth())

/*
 * GENERAL CHAT (no insight required)
 *
 * What it does:
 * - Loads / stores messages where insight_id IS NULL for this user
 * - Answers with Claude using live financial context only
 *
 * Why we need it:
 * - Floating "Ask Soverm" and Expense Analyzer chat should work before the
 *   first weekly insight is generated
 *
 * Important: these routes are registered BEFORE /:insightId so Express does
 * not treat the word "general" as a UUID path param.
 */
router.get('/general', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const messagesResult = await db.query(
      `SELECT role, content, created_at
       FROM chat_messages
       WHERE user_id = $1 AND insight_id IS NULL
       ORDER BY created_at ASC`,
      [userId]
    )

    res.json({ messages: messagesResult.rows })
  } catch (err) {
    reportServerError('to load general chat messages', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/general', chatRateLimitMiddleware(), async (req, res) => {
  const { userId } = getAuth(req)

  const messageCheck = validateChatMessage(req.body?.message)
  if (messageCheck.error) {
    return res.status(400).json({ error: messageCheck.error })
  }

  try {
    await ensureUserExists(userId)

    const trimmedMessage = messageCheck.value

    const [historyResult, chatFinancialContext] = await Promise.all([
      db.query(
        `SELECT role, content
         FROM (
           SELECT role, content, created_at
           FROM chat_messages
           WHERE user_id = $1 AND insight_id IS NULL
           ORDER BY created_at DESC
           LIMIT 30
         ) recent
         ORDER BY created_at ASC`,
        [userId]
      ),
      loadChatFinancialContext(userId),
    ])

    const claudeResponseText = await askFinancialQuestion(
      null,
      historyResult.rows,
      trimmedMessage,
      {
        chatFinancialContext,
        insightActions: chatFinancialContext?.openActions ?? [],
      }
    )

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
         VALUES (gen_random_uuid(), $1, NULL, 'user', $2)`,
        [userId, trimmedMessage]
      )

      await client.query(
        `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
         VALUES (gen_random_uuid(), $1, NULL, 'assistant', $2)`,
        [userId, claudeResponseText]
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
    reportServerError('to send general chat message', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.get('/:insightId', async (req, res) => {
  const { userId } = getAuth(req)

  const idCheck = validateUuidParam(req.params.insightId, 'insightId')
  if (idCheck.error) {
    return res.status(400).json({ error: idCheck.error })
  }

  try {
    const { insightId } = req.params

    const insightResult = await db.query(
      `SELECT id FROM insights WHERE id = $1 AND user_id = $2`,
      [insightId, userId]
    )

    if (insightResult.rows.length === 0) {
      return res.status(404).json({ error: 'Insight not found' })
    }

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

  const idCheck = validateUuidParam(req.params.insightId, 'insightId')
  if (idCheck.error) {
    return res.status(400).json({ error: idCheck.error })
  }

  const messageCheck = validateChatMessage(req.body?.message)
  if (messageCheck.error) {
    return res.status(400).json({ error: messageCheck.error })
  }

  try {
    await ensureUserExists(userId)

    const { insightId } = req.params
    const trimmedMessage = messageCheck.value

    const [insightResult, historyResult, chatFinancialContext, insightActionsResult] =
      await Promise.all([
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
           LIMIT 30
         ) recent
         ORDER BY created_at ASC`,
        [insightId, userId]
      ),
      loadChatFinancialContext(userId),
      loadInsightActionsForChat(userId, insightId),
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
        chatFinancialContext,
        insightActions: insightActionsResult,
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
