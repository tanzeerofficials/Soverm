/*
 * EXPENSE ANALYZER ROUTES FILE
 *
 * Aggregates category MoM breakdown and recurring charge detection
 * for the Expense Analyzer page.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import {
  buildExpenseAnalyzerSummary,
  loadExpenseAnalyzerData,
} from '../utils/expenseAnalyzerData.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/expense-analyzer/summary
 *
 * Lightweight payload for dashboard teaser — recurring count, total, top mover.
 */
router.get('/summary', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const payload = await loadExpenseAnalyzerData(userId)
    res.json(buildExpenseAnalyzerSummary(payload))
  } catch (err) {
    reportServerError('to load expense analyzer summary', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * GET /api/expense-analyzer
 *
 * Full Expense Analyzer payload — category breakdown, recurring charges,
 * overall spending, narrative summary, and derived top mover.
 */
router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const payload = await loadExpenseAnalyzerData(userId)
    res.json(payload)
  } catch (err) {
    reportServerError('to load expense analyzer data', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
