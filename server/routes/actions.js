/*
 * ACTIONS ROUTES FILE
 *
 * Lists and updates user action items generated from AI insights.
 */

import { Router } from 'express'
import { getAuth } from '@clerk/express'
import db from '../db/index.js'

const router = Router()

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
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

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
    console.error('Failed to fetch actions:', err.message)
    res.status(500).json({ error: err.message })
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
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { completed } = req.body

    await db.query(
      `UPDATE actions SET completed = $1
       WHERE id = $2 AND user_id = $3`,
      [completed, req.params.id, userId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Failed to update action:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
