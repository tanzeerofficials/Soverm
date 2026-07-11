/*
 * EXPORT ROUTES
 *
 * Downloadable monthly snapshot as JSON or CSV.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import {
  buildMonthlySnapshot,
  monthlySnapshotToCsv,
} from '../services/monthlyExport.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/export/monthly-snapshot?format=json|csv&month=YYYY-MM-01
 */
router.get('/monthly-snapshot', async (req, res) => {
  const { userId } = getAuth(req)
  const format = String(req.query.format || 'json').toLowerCase()
  const month = req.query.month ? String(req.query.month).slice(0, 10) : undefined

  try {
    const snapshot = await buildMonthlySnapshot(userId, { monthIso: month })

    if (format === 'csv') {
      const csv = monthlySnapshotToCsv(snapshot)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="soverm-monthly-snapshot-${snapshot.period.start}.csv"`
      )
      return res.send(csv)
    }

    res.json({ success: true, snapshot })
  } catch (err) {
    reportServerError('to build monthly export', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
