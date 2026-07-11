/*
 * BILLING ROUTES
 *
 * Authenticated endpoints for starting Soverm Pro Checkout.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import {
  createProCheckoutSession,
  isStripeBillingConfigured,
} from '../services/stripeBilling.js'

const router = Router()

router.use(requireAuth())

router.get('/status', async (req, res) => {
  res.json({
    configured: isStripeBillingConfigured(),
  })
})

/*
 * POST /api/billing/checkout
 *
 * What it does:
 * - Creates a Stripe Checkout session for monthly Pro
 * - Returns the hosted Checkout URL for the browser to open
 *
 * Why we need it:
 * - Pricing / paywall CTAs need a real payment path once Stripe env vars are set
 */
router.post('/checkout', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    if (!isStripeBillingConfigured()) {
      return res.status(503).json({
        error: 'billing_not_configured',
        message: 'Soverm Pro checkout is not available yet.',
      })
    }

    await ensureUserExists(userId)

    const session = await createProCheckoutSession({
      userId,
      email: req.body?.email,
    })

    res.json({
      success: true,
      url: session.url,
      sessionId: session.sessionId,
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 503) {
      return res.status(err.statusCode).json({ error: err.message })
    }

    reportServerError('to create Stripe checkout session', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
