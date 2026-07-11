/*
 * PAYDAY ROUTES
 *
 * GET  /api/payday — profile + inference suggestion when unset
 * PUT  /api/payday — confirm/edit cadence + next payday
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import {
  getPaydayProfile,
  inferPaydayFromTransactions,
  upsertPayday,
} from '../services/payday.js'

const router = Router()

router.use(requireAuth())

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const payday = await getPaydayProfile(userId)
    let suggestion = null

    if (!payday.configured) {
      suggestion = await inferPaydayFromTransactions(userId)
    }

    res.json({ payday, suggestion })
  } catch (err) {
    reportServerError('to load payday profile', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.put('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const payday = await upsertPayday(userId, {
      payCadence: req.body?.payCadence,
      nextPaydayOn: req.body?.nextPaydayOn,
      source: 'user',
    })
    res.json({ payday })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 503) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    reportServerError('to save payday profile', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
