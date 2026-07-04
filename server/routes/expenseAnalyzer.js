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
import {
  getPersonalNarrativeStatus,
  loadOrGeneratePersonalNarrative,
} from '../services/expenseAnalyzerNarrative.js'
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

/*
 * GET /api/expense-analyzer/narrative
 *
 * Returns cached personalized narrative for the current payload fingerprint, if any.
 * Does not call Claude — safe to poll on page load.
 */
router.get('/narrative', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const payload = await loadExpenseAnalyzerData(userId)
    const status = await getPersonalNarrativeStatus(userId, payload)

    res.json({
      fingerprint: status.fingerprint,
      cached: status.cached,
      narrative: status.cached ? status.narrative : null,
      templateSummary: payload.narrativeSummary,
      confirmedRecurringMonthly: payload.narrativeMeta?.confirmedRecurringMonthly ?? payload.totalRecurringMonthly,
    })
  } catch (err) {
    reportServerError('to load expense analyzer narrative cache', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

/*
 * POST /api/expense-analyzer/narrative
 *
 * Returns cached narrative or generates a new personalized summary via Claude.
 * Validates all dollar amounts against the structured brief before responding.
 */
router.post('/narrative', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const payload = await loadExpenseAnalyzerData(userId)
    const narrative = await loadOrGeneratePersonalNarrative(userId, payload)

    res.json({
      fingerprint: narrative.fingerprint,
      lead: narrative.lead,
      paragraphs: narrative.paragraphs,
      generatedAt: narrative.generatedAt,
      source: narrative.source,
      templateSummary: payload.narrativeSummary,
      confirmedRecurringMonthly: payload.narrativeMeta?.confirmedRecurringMonthly ?? payload.totalRecurringMonthly,
    })
  } catch (err) {
    reportServerError('to generate expense analyzer narrative', err, { userId, req })

    if (err.message?.startsWith('Narrative validation failed')) {
      res.status(422).json({
        error: 'We couldn’t produce a reliable personalized summary. The standard summary and breakdown below are still accurate.',
        code: 'NARRATIVE_VALIDATION_FAILED',
      })
      return
    }

    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
