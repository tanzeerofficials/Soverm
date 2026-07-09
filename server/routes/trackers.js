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
import {
  applySavingsTransferDetection,
  dismissSavingsTransferDetection,
} from '../services/savingsTransferDetection.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { validateUuidParam } from '../utils/validation.js'

async function respondWithSnapshot(res, userId, extra = {}) {
  const snapshot = await buildTrackerSnapshotWithFallback(userId)
  res.json({ ...extra, ...snapshot })
}

export function createTrackersRouter({
  authenticate = requireAuth(),
  resolveUserId = (req) => getAuth(req).userId,
} = {}) {
  const router = Router()

  router.use(authenticate)

  router.get('/', async (req, res) => {
    const userId = resolveUserId(req)

    try {
      const snapshot = await buildTrackerSnapshotWithFallback(userId)
      res.json(snapshot)
    } catch (err) {
      if (err.statusCode === 503) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to load tracker snapshot', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  router.post('/', async (req, res) => {
    const userId = resolveUserId(req)

    try {
      await ensureUserExists(userId)
      const tracker = await createTracker(userId, req.body)
      await respondWithSnapshot(res, userId, { tracker })
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ error: err.message })
      }

      if (err.statusCode === 503 || err.message.includes('migration 013') || err.message.includes('migration 014') || err.message.includes('migration 016')) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to create tracker', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  router.post('/savings-detections/:id/apply', async (req, res) => {
    const userId = resolveUserId(req)
    const { id } = req.params

    const idCheck = validateUuidParam(id, 'detection id')
    if (idCheck.error) {
      return res.status(400).json({ error: idCheck.error })
    }

    const trackerId = req.body?.trackerId

    if (trackerId != null) {
      const trackerCheck = validateUuidParam(trackerId, 'tracker id')
      if (trackerCheck.error) {
        return res.status(400).json({ error: trackerCheck.error })
      }
    }

    try {
      const result = await applySavingsTransferDetection(userId, id, trackerId)
      await respondWithSnapshot(res, userId, result)
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ error: err.message })
      }

      if (err.statusCode === 404) {
        return res.status(404).json({ error: err.message })
      }

      if (err.statusCode === 503 || err.message.includes('migration 017')) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to apply savings detection', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  router.post('/savings-detections/:id/dismiss', async (req, res) => {
    const userId = resolveUserId(req)
    const { id } = req.params

    const idCheck = validateUuidParam(id, 'detection id')
    if (idCheck.error) {
      return res.status(400).json({ error: idCheck.error })
    }

    try {
      const result = await dismissSavingsTransferDetection(userId, id)
      await respondWithSnapshot(res, userId, result)
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: err.message })
      }

      if (err.statusCode === 503 || err.message.includes('migration 017')) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to dismiss savings detection', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  router.patch('/:id', async (req, res) => {
    const userId = resolveUserId(req)
    const { id } = req.params

    const idCheck = validateUuidParam(id, 'tracker id')
    if (idCheck.error) {
      return res.status(400).json({ error: idCheck.error })
    }

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

      if (err.statusCode === 503 || err.message.includes('migration 013') || err.message.includes('migration 014') || err.message.includes('migration 016')) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to update tracker', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  router.delete('/:id', async (req, res) => {
    const userId = resolveUserId(req)
    const { id } = req.params

    const idCheck = validateUuidParam(id, 'tracker id')
    if (idCheck.error) {
      return res.status(400).json({ error: idCheck.error })
    }

    try {
      await deleteTracker(userId, id)
      await respondWithSnapshot(res, userId, { id })
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(404).json({ error: err.message })
      }

      if (err.statusCode === 503 || err.message.includes('migration 013') || err.message.includes('migration 014')) {
        return res.status(503).json({ error: err.message })
      }

      reportServerError('to delete tracker', err, { userId, req })
      res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
    }
  })

  return router
}

const router = createTrackersRouter()

export default router
