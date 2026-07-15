/*
 * BILLING ROUTES
 *
 * Authenticated endpoints for Soverm Pro Checkout and Customer Portal.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import { ensureUserExists } from '../utils/ensureUser.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'
import { getUserTier } from '../utils/usage.js'
import {
  createBillingPortalSession,
  createProCheckoutSession,
  isStripeBillingConfigured,
} from '../services/stripeBilling.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/billing/status
 *
 * What it does: tells the client whether Stripe is configured and the
 * user's current subscription_tier from the DB.
 *
 * Why: Settings can disable Upgrade when checkout is unavailable, and
 * show plan state without waiting solely on the usage endpoint.
 */
router.get('/status', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const tier = await getUserTier(userId)

    res.json({
      configured: isStripeBillingConfigured(),
      tier,
      isPro: tier === 'pro',
    })
  } catch (err) {
    reportServerError('to load billing status', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
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

/*
 * POST /api/billing/portal
 *
 * What it does: creates a Stripe Customer Portal session for Pro users
 * so they can update payment methods or cancel.
 *
 * Why: Terms promise cancel anytime; Checkout alone cannot manage an
 * existing subscription.
 */
router.post('/portal', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    if (!isStripeBillingConfigured()) {
      return res.status(503).json({
        error: 'billing_not_configured',
        message: 'Billing management is not available yet.',
      })
    }

    await ensureUserExists(userId)

    const session = await createBillingPortalSession({ userId })

    res.json({
      success: true,
      url: session.url,
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 503) {
      return res.status(err.statusCode).json({ error: err.message })
    }

    reportServerError('to create Stripe billing portal session', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router
