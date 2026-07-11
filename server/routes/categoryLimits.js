/*
 * CATEGORY SOFT LIMIT ROUTES
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { ensureUserExists } from '../utils/ensureUser.js'
import {
  deleteCategorySoftLimit,
  listCategorySoftLimits,
  upsertCategorySoftLimit,
} from '../services/categorySoftLimits.js'

const router = Router()

router.use(requireAuth())

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const limits = await listCategorySoftLimits(userId)
    res.json({ limits })
  } catch (err) {
    reportServerError('to list category soft limits', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.post('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const limit = await upsertCategorySoftLimit(userId, {
      category: req.body?.category,
      monthlyLimit: req.body?.monthlyLimit,
      alertWarningPercent: req.body?.alertWarningPercent,
    })
    res.status(201).json({ limit })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 503) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    reportServerError('to upsert category soft limit', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.delete('/:id', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const result = await deleteCategorySoftLimit(userId, req.params.id)
    if (!result.deleted) {
      return res.status(404).json({ error: 'Limit not found' })
    }
    res.json({ success: true })
  } catch (err) {
    reportServerError('to delete category soft limit', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
