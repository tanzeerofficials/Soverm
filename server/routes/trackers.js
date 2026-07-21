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
import db from '../db/index.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import {
  assertProTier,
  assertTrackerCreateAllowed,
  assertTrackerDeleteAllowed,
  assertTrackerUpdateAllowed,
} from '../utils/usage.js'
import { GENERIC_ERROR_MESSAGE, TEMPORARILY_UNAVAILABLE_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { validateUuidParam } from '../utils/validation.js'

async function getActiveTrackerType(userId, trackerId) {
  const result = await db.query(
    `SELECT track_type
     FROM monthly_trackers
     WHERE id = $1 AND user_id = $2 AND active = true`,
    [trackerId, userId]
  )
  return result.rows[0]?.track_type ?? null
}

function handleTrackerRouteError(res, err, { userId, req, label }) {
  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message })
  }

  if (err.statusCode === 403) {
    return res.status(403).json({
      error: err.code || 'pro_required',
      message: err.message,
    })
  }

  if (err.statusCode === 404) {
    return res.status(404).json({ error: err.message })
  }

  if (err.statusCode === 409) {
    return res.status(409).json({
      error: err.message,
      code: err.code || 'possible_duplicate',
    })
  }

  if (
    err.statusCode === 503 ||
    /migration 01[3467]/i.test(err.message)
  ) {
    // Log the real cause for ops; clients only see a generic unavailable message.
    console.warn(`[trackers] temporarily unavailable: ${err.message}`)
    return res.status(503).json({ error: TEMPORARILY_UNAVAILABLE_MESSAGE })
  }

  reportServerError(label, err, { userId, req })
  return res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
}

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
      await assertTrackerCreateAllowed(userId, req.body)
      const tracker = await createTracker(userId, req.body)
      await respondWithSnapshot(res, userId, { tracker })
    } catch (err) {
      return handleTrackerRouteError(res, err, {
        userId,
        req,
        label: 'to create tracker',
      })
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
    const force = req.body?.force === true

    if (trackerId != null) {
      const trackerCheck = validateUuidParam(trackerId, 'tracker id')
      if (trackerCheck.error) {
        return res.status(400).json({ error: trackerCheck.error })
      }
    }

    try {
      await assertProTier(userId)
      const result = await applySavingsTransferDetection(userId, id, trackerId, { force })
      await respondWithSnapshot(res, userId, result)
    } catch (err) {
      return handleTrackerRouteError(res, err, {
        userId,
        req,
        label: 'to apply savings detection',
      })
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
      await assertProTier(userId)
      const result = await dismissSavingsTransferDetection(userId, id)
      await respondWithSnapshot(res, userId, result)
    } catch (err) {
      return handleTrackerRouteError(res, err, {
        userId,
        req,
        label: 'to dismiss savings detection',
      })
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
      const trackType = await getActiveTrackerType(userId, id)
      if (!trackType) {
        return res.status(404).json({ error: 'Tracker not found' })
      }
      await assertTrackerUpdateAllowed(userId, trackType, req.body)
      const tracker = await updateTracker(userId, id, req.body)
      await respondWithSnapshot(res, userId, { tracker })
    } catch (err) {
      return handleTrackerRouteError(res, err, {
        userId,
        req,
        label: 'to update tracker',
      })
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
      const trackType = await getActiveTrackerType(userId, id)
      if (!trackType) {
        return res.status(404).json({ error: 'Tracker not found' })
      }
      await assertTrackerDeleteAllowed(userId, trackType)
      await deleteTracker(userId, id)
      await respondWithSnapshot(res, userId, { id })
    } catch (err) {
      return handleTrackerRouteError(res, err, {
        userId,
        req,
        label: 'to delete tracker',
      })
    }
  })

  return router
}

const router = createTrackersRouter()

export default router
