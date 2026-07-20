/*
 * ACTIONS ROUTES FILE
 *
 * Lists and updates user action items (insight + weekly closed-loop).
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { validateBooleanField, validateUuidParam } from '../utils/validation.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { getCalendarWeekWindow } from '../utils/calendarWeek.js'
import {
  createAction,
  listRecentActions,
  updateActionStatus,
} from '../services/actionsService.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/actions
 */
router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const actions = await listRecentActions(userId, { limit: 20 })
    res.json({ actions })
  } catch (err) {
    reportServerError('to fetch actions', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * POST /api/actions
 * Accept a weekly (or other) action into the closed-loop.
 *
 * If insightId is sent, it must be a UUID that belongs to this user
 * (ownership is enforced in createAction — otherwise anyone could attach
 * another user's insight id to their action row).
 */
router.post('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)

    let insightId = req.body?.insightId ?? null
    if (insightId != null && insightId !== '') {
      const idCheck = validateUuidParam(insightId, 'insightId')
      if (idCheck.error) {
        return res.status(400).json({ error: idCheck.error })
      }
      insightId = idCheck.value
    } else {
      insightId = null
    }

    const week = getCalendarWeekWindow()
    const action = await createAction(userId, {
      description: req.body?.description,
      source: req.body?.source ?? 'weekly',
      status: req.body?.status ?? 'accepted',
      weekStartOn: req.body?.weekStartOn ?? week.weekStartIso,
      metadata: req.body?.metadata ?? {},
      insightId,
    })
    res.status(201).json({ action })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message })
    }
    reportServerError('to create action', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * PATCH /api/actions/:id
 * Supports legacy { completed } and closed-loop { status }.
 */
router.patch('/:id', async (req, res) => {
  const { userId } = getAuth(req)

  const idCheck = validateUuidParam(req.params.id, 'action id')
  if (idCheck.error) {
    return res.status(400).json({ error: idCheck.error })
  }

  const hasStatus = req.body?.status != null
  const hasCompleted = req.body?.completed != null

  if (!hasStatus && !hasCompleted) {
    return res.status(400).json({ error: 'status or completed is required' })
  }

  if (hasCompleted && !hasStatus) {
    const completedCheck = validateBooleanField(req.body?.completed, 'completed')
    if (completedCheck.error) {
      return res.status(400).json({ error: completedCheck.error })
    }
  }

  try {
    const action = await updateActionStatus(userId, req.params.id, {
      status: hasStatus ? req.body.status : undefined,
      completed: hasCompleted ? Boolean(req.body.completed) : undefined,
    })

    if (!action) {
      return res.status(404).json({ error: 'Action not found' })
    }

    res.json({ success: true, action })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }
    reportServerError('to update action', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
