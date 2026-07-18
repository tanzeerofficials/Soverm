/*
 * CHAT ROUTES FILE
 *
 * Follow-up Q&A scoped to a single insight thread (or general chat).
 * Supports JSON replies and SSE streaming for progressive tokens.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import {
  askFinancialQuestion,
  askFinancialQuestionStream,
  resolveInsightGeneratedAt,
  CHAT_HISTORY_MESSAGE_LIMIT,
} from '../services/claude.js'
import { evaluateBeforeYouSpendForUser } from '../services/beforeYouSpend.js'
import { loadChatFinancialContext, loadInsightActionsForChat } from '../utils/chatFinancialContext.js'
import { extractSpendIntent } from '../utils/extractSpendIntent.js'
import {
  chatRateLimitMiddleware,
  getChatRateLimitStatus,
} from '../utils/rateLimit.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { validateChatMessage, validateUuidParam } from '../utils/validation.js'

const router = Router()

router.use(requireAuth())

function wantsStream(req) {
  const accept = String(req.headers.accept || '')
  return accept.includes('text/event-stream') || req.query.stream === '1'
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
  // Flush when available so proxies / browsers see status before Claude returns.
  if (typeof res.flush === 'function') {
    res.flush()
  }
}

function beginChatSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }
}

function chatLimitPayload(status) {
  return {
    remaining: status.remaining,
    limit: status.limit,
    count: status.count,
    allowed: status.allowed,
    period: status.period ?? 'hour',
    retryAfterSeconds: status.retryAfterSeconds ?? null,
  }
}

/*
 * What this does: if the user asks "can I afford $X?", run the same Before You
 * Spend judgment the Quick Tools panel uses, then pass it into Claude so the
 * answer leads with a deterministic verdict instead of free-form guessing.
 */
async function loadBeforeYouSpendForMessage(userId, message) {
  const intent = extractSpendIntent(message)
  if (!intent) {
    return null
  }

  try {
    return await evaluateBeforeYouSpendForUser(userId, intent)
  } catch (err) {
    console.warn('Before You Spend skipped for chat:', err.message)
    return null
  }
}

async function persistChatExchange({
  userId,
  insightId,
  userMessage,
  assistantMessage,
}) {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
       VALUES (gen_random_uuid(), $1, $2, 'user', $3)`,
      [userId, insightId, userMessage]
    )

    await client.query(
      `INSERT INTO chat_messages (id, user_id, insight_id, role, content)
       VALUES (gen_random_uuid(), $1, $2, 'assistant', $3)`,
      [userId, insightId, assistantMessage]
    )

    await client.query('COMMIT')
  } catch (dbErr) {
    await client.query('ROLLBACK')
    throw dbErr
  } finally {
    client.release()
  }
}

async function respondWithChatAnswer(req, res, {
  userId,
  insightId,
  insightContent,
  generatedAt,
  historyRows,
  chatFinancialContext,
  insightActions,
  trimmedMessage,
  errorLabel,
  streamAlreadyStarted = false,
}) {
  const beforeYouSpendVerdict = await loadBeforeYouSpendForMessage(
    userId,
    trimmedMessage
  )

  const askOptions = {
    generatedAt,
    chatFinancialContext,
    insightActions,
    beforeYouSpendVerdict,
    userId,
  }

  if (wantsStream(req)) {
    if (!streamAlreadyStarted) {
      beginChatSse(res)
    }

    try {
      const claudeResponseText = await askFinancialQuestionStream(
        insightContent,
        historyRows,
        trimmedMessage,
        askOptions,
        {
          onDelta: (_delta, fullText) => {
            writeSse(res, { type: 'delta', text: fullText })
          },
          onStatus: (status) => {
            writeSse(res, {
              type: 'status',
              phase: status.phase,
              title: status.title ?? null,
              detail: status.detail ?? null,
            })
          },
        }
      )

      await persistChatExchange({
        userId,
        insightId,
        userMessage: trimmedMessage,
        assistantMessage: claudeResponseText,
      })

      const chatLimit = chatLimitPayload(await getChatRateLimitStatus(userId))
      writeSse(res, { type: 'done', reply: claudeResponseText, chatLimit })
      res.end()
    } catch (err) {
      reportServerError(errorLabel, err, { userId, req })
      writeSse(res, { type: 'error', message: GENERIC_ERROR_MESSAGE })
      res.end()
    }
    return
  }

  try {
    const claudeResponseText = await askFinancialQuestion(
      insightContent,
      historyRows,
      trimmedMessage,
      askOptions
    )

    await persistChatExchange({
      userId,
      insightId,
      userMessage: trimmedMessage,
      assistantMessage: claudeResponseText,
    })

    const chatLimit = chatLimitPayload(await getChatRateLimitStatus(userId))
    res.json({ reply: claudeResponseText, chatLimit })
  } catch (err) {
    reportServerError(errorLabel, err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
}

/*
 * GET /api/chat/limits
 *
 * Remaining Ask Soverm messages (daily cap for Free, hourly cap for Pro).
 * Registered before /:insightId so "limits" is not treated as a UUID.
 */
router.get('/limits', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const status = await getChatRateLimitStatus(userId)
    res.json(chatLimitPayload(status))
  } catch (err) {
    reportServerError('to load chat limits', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

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

  const trimmedMessage = messageCheck.value
  const streaming = wantsStream(req)

  /*
   * Open the SSE stream before loading context so the UI gets an immediate
   * "Thinking…" status instead of sitting silent for 10–30s.
   */
  if (streaming) {
    beginChatSse(res)
    writeSse(res, {
      type: 'status',
      phase: 'thinking',
      title: 'Thinking…',
      detail: null,
    })
  }

  try {
    await ensureUserExists(userId)

    const [historyResult, chatFinancialContext] = await Promise.all([
      db.query(
        `SELECT role, content
         FROM (
           SELECT role, content, created_at
           FROM chat_messages
           WHERE user_id = $1 AND insight_id IS NULL
           ORDER BY created_at DESC
           LIMIT ${CHAT_HISTORY_MESSAGE_LIMIT}
         ) recent
         ORDER BY created_at ASC`,
        [userId]
      ),
      loadChatFinancialContext(userId),
    ])

    await respondWithChatAnswer(req, res, {
      userId,
      insightId: null,
      insightContent: null,
      generatedAt: undefined,
      historyRows: historyResult.rows,
      chatFinancialContext,
      insightActions: chatFinancialContext?.openActions ?? [],
      trimmedMessage,
      errorLabel: 'to send general chat message',
      streamAlreadyStarted: streaming,
    })
  } catch (err) {
    reportServerError('to send general chat message', err, { userId, req })
    if (streaming) {
      writeSse(res, { type: 'error', message: GENERIC_ERROR_MESSAGE })
      res.end()
      return
    }
    if (!res.headersSent) {
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
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

  const { insightId } = req.params
  const trimmedMessage = messageCheck.value
  const streaming = wantsStream(req)

  if (streaming) {
    beginChatSse(res)
    writeSse(res, {
      type: 'status',
      phase: 'thinking',
      title: 'Thinking…',
      detail: null,
    })
  }

  try {
    await ensureUserExists(userId)

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
             LIMIT ${CHAT_HISTORY_MESSAGE_LIMIT}
           ) recent
           ORDER BY created_at ASC`,
          [insightId, userId]
        ),
        loadChatFinancialContext(userId),
        loadInsightActionsForChat(userId, insightId),
      ])

    if (insightResult.rows.length === 0) {
      if (streaming) {
        writeSse(res, { type: 'error', message: 'Insight not found' })
        res.end()
        return
      }
      return res.status(404).json({ error: 'Insight not found' })
    }

    const insightRow = insightResult.rows[0]

    await respondWithChatAnswer(req, res, {
      userId,
      insightId,
      insightContent: insightRow.content,
      generatedAt: resolveInsightGeneratedAt(
        insightRow.content,
        insightRow.created_at
      ),
      historyRows: historyResult.rows,
      chatFinancialContext,
      insightActions: insightActionsResult,
      trimmedMessage,
      errorLabel: 'to send chat message',
      streamAlreadyStarted: streaming,
    })
  } catch (err) {
    reportServerError('to send chat message', err, { userId, req })
    if (streaming) {
      writeSse(res, { type: 'error', message: GENERIC_ERROR_MESSAGE })
      res.end()
      return
    }
    if (!res.headersSent) {
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  }
})

export default router
