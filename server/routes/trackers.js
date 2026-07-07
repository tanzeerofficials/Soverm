/*
 * MONTHLY TRACKERS ROUTES
 *
 * GET    /api/trackers       — snapshot with progress for all active trackers
 * POST   /api/trackers       — create spending cap or savings goal
 * PATCH  /api/trackers/:id   — update tracker fields / logged savings progress
 * DELETE /api/trackers/:id   — archive a tracker
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

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const snapshot = await buildTrackerSnapshotWithFallback(userId)
    res.json(snapshot)
  } catch (err) {
    reportServerError('to load tracker snapshot', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const tracker = await createTracker(userId, req.body)
    await respondWithSnapshot(res, userId, { tracker })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }

    if (err.message.includes('migration 013')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to create tracker', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/:id', async (req, res) => {
  const { userId } = getAuth(req)
  const { id } = req.params

  try {
    const tracker = await updateTracker(userId, id, req.body)
    await respondWithSnapshot(res, userId, { tracker })
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message })
    }

    if (err.message.includes('migration 013')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to update tracker', err, { userId, req })
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

    if (err.message.includes('migration 013')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to delete tracker', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
