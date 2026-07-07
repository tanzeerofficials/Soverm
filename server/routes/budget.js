/*
 * BUDGET ROUTES
 *
 * GET  /api/budget — safe-to-spend snapshot for the current calendar month
 * PATCH /api/budget — set or update the user's monthly spending target
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { buildTrackerSnapshotWithFallback } from '../services/trackerSnapshot.js'
import { createTracker } from '../services/monthlyTrackersService.js'
import { setMonthlyBudget } from '../utils/budgetPreferences.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

const MIN_BUDGET = 1
const MAX_BUDGET = 999_999.99

function parseMonthlyBudget(value) {
  if (value == null) {
    return { error: 'monthlyBudget is required' }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return { error: 'monthlyBudget must be a number' }
  }

  if (parsed < MIN_BUDGET || parsed > MAX_BUDGET) {
    return { error: `monthlyBudget must be between ${MIN_BUDGET} and ${MAX_BUDGET}` }
  }

  return { value: roundCurrency(parsed) }
}

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const snapshot = await buildTrackerSnapshotWithFallback(userId)
    res.json(snapshot)
  } catch (err) {
    reportServerError('to load budget snapshot', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const parsed = parseMonthlyBudget(req.body?.monthlyBudget)

    if (parsed.error) {
      return res.status(400).json({ error: parsed.error })
    }

    await ensureUserExists(userId)

    try {
      await createTracker(userId, {
        trackType: 'spending',
        name: 'Monthly spending',
        monthlyAmount: parsed.value,
      })
    } catch (trackerErr) {
      if (!trackerErr.message.includes('migration 013')) {
        throw trackerErr
      }
      await setMonthlyBudget(userId, parsed.value)
    }

    const snapshot = await buildTrackerSnapshotWithFallback(userId)
    res.json(snapshot)
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' })
    }

    if (err.message.includes('migration 011')) {
      return res.status(503).json({ error: err.message })
    }

    reportServerError('to update monthly budget', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
