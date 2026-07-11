/*
 * BEFORE YOU SPEND ROUTES
 *
 * POST /api/before-you-spend — { amount, category? }
 * Optional paycheck-to-paycheck affordability check (T2.3).
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import { evaluateBeforeYouSpendForUser } from '../services/beforeYouSpend.js'

const router = Router()

router.use(requireAuth())

router.post('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)

    const amount = Number(req.body?.amount)
    const category =
      typeof req.body?.category === 'string' && req.body.category.trim()
        ? req.body.category.trim()
        : null

    const result = await evaluateBeforeYouSpendForUser(userId, {
      amount,
      category,
    })

    res.json(result)
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message })
    }
    reportServerError('to evaluate before-you-spend', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
