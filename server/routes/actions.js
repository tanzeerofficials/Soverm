/*
 * ACTIONS ROUTES FILE
 *
 * Lists and updates user action items generated from AI insights.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import db from '../db/index.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { validateBooleanField, validateUuidParam } from '../utils/validation.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/actions
 *
 * What it does:
 * - Returns the user's 10 most recent action items
 *
 * Why we need it:
 * - Dashboard todo list loads persisted actions from the database
 */
router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const result = await db.query(
      `SELECT id, description, completed, created_at
       FROM actions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    )

    res.json({ actions: result.rows })
  } catch (err) {
    reportServerError('to fetch actions', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * PATCH /api/actions/:id
 *
 * What it does:
 * - Updates the completed flag on one action (e.g. checkbox toggle)
 *
 * Why PATCH not PUT:
 * - Only changes one field; client does not send the full action resource
 */
router.patch('/:id', async (req, res) => {
  const { userId } = getAuth(req)

  const idCheck = validateUuidParam(req.params.id, 'action id')
  if (idCheck.error) {
    return res.status(400).json({ error: idCheck.error })
  }

  const completedCheck = validateBooleanField(req.body?.completed, 'completed')
  if (completedCheck.error) {
    return res.status(400).json({ error: completedCheck.error })
  }

  try {
    const result = await db.query(
      `UPDATE actions SET completed = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [completedCheck.value, req.params.id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action not found' })
    }

    res.json({ success: true })
  } catch (err) {
    reportServerError('to update action', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
