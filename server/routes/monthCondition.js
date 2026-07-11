/*
 * MONTH CONDITION LETTER ROUTES
 *
 * GET /api/month-condition?month=YYYY-MM
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { buildMonthConditionLetterForUser } from '../services/monthConditionLetter.js'

const router = Router()

router.use(requireAuth())

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)
  const month = req.query.month ? String(req.query.month).slice(0, 7) : null

  try {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month must be YYYY-MM' })
    }

    const letter = await buildMonthConditionLetterForUser(userId, { monthKey: month })
    res.json(letter)
  } catch (err) {
    reportServerError('to build month condition letter', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
