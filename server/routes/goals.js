/*
 * SAVINGS GOALS ROUTES
 *
 * POST   /api/goals       — create a goal
 * PATCH  /api/goals/:id   — update name, amounts, progress
 * DELETE /api/goals/:id   — archive a goal
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { buildTrackerSnapshotWithFallback } from '../services/trackerSnapshot.js'
import {
  createTracker,
  deleteTracker,
  updateTracker,
} from '../services/monthlyTrackersService.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

async function respondWithSnapshot(res, userId, extra = {}) {
  const snapshot = await buildTrackerSnapshotWithFallback(userId)
  res.json({ ...extra, ...snapshot })
}

function mapGoalBodyToTracker(body) {
  return {
    trackType: 'saving',
    name: body?.name,
    purposeType: body?.purposeType,
    monthlyAmount: body?.monthlyAmount,
    targetTotal: body?.targetTotal,
  }
}

function mapGoalUpdateBody(body) {
  const mapped = { ...body }
  if (body?.savedSoFar != null) {
    mapped.progressAmount = body.savedSoFar
    delete mapped.savedSoFar
  }
  return mapped
}

router.post('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const tracker = await createTracker(userId, mapGoalBodyToTracker(req.body))
    await respondWithSnapshot(res, userId, { tracker, goal: tracker })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }

    if (err.message.includes('migration 013') || err.message.includes('migration 012')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to create savings goal', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/:id', async (req, res) => {
  const { userId } = getAuth(req)
  const { id } = req.params

  try {
    const tracker = await updateTracker(userId, id, mapGoalUpdateBody(req.body))
    await respondWithSnapshot(res, userId, { tracker, goal: tracker })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message })
    }

    if (err.message.includes('migration 013') || err.message.includes('migration 012')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to update savings goal', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.delete('/:id', async (req, res) => {
  const { userId } = getAuth(req)
  const { id } = req.params

  try {
    await deleteTracker(userId, id)
    await respondWithSnapshot(res, userId, { id })
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message })
    }

    if (err.message.includes('migration 013') || err.message.includes('migration 012')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to delete savings goal', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
