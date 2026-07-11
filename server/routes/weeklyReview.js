/*
 * WEEKLY REVIEW ROUTES
 *
 * GET /api/weekly-review — paycheck-to-paycheck weekly check-in
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { buildWeeklyReviewForUser } from '../services/weeklyReview.js'

const router = Router()

router.use(requireAuth())

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const review = await buildWeeklyReviewForUser(userId)
    res.json(review)
  } catch (err) {
    reportServerError('to build weekly review', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
