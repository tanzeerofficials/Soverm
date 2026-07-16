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
import {
  createBillingPortalSession,
  createProCheckoutSession,
  getBillingAccessStatus,
  isStripeBillingConfigured,
  reactivateProSubscription,
} from '../services/stripeBilling.js'

const router = Router()

router.use(requireAuth())

/*
 * GET /api/billing/status
 *
 * What it does: tells the client whether Stripe is configured, the user's
 * plan tier, and — if they canceled in the portal — when Pro access ends.
 *
 * Why: Profile must show "Pro until {date}" after cancel-at-period-end so
 * users know features stay available through the paid period.
 */
router.get('/status', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await ensureUserExists(userId)
    const access = await getBillingAccessStatus(userId)

    res.json({
      configured: isStripeBillingConfigured(),
      tier: access.tier,
      isPro: access.isPro,
      cancelAtPeriodEnd: access.cancelAtPeriodEnd,
      currentPeriodEnd: access.currentPeriodEnd,
      proAccessEndsAt: access.proAccessEndsAt,
      hasStripeCustomer: access.hasStripeCustomer,
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
 * POST /api/billing/reactivate
 *
 * What it does: clears cancel_at_period_end on the active Stripe subscription.
 * Why: Profile needs an obvious Keep Pro / Resubscribe after a scheduled cancel.
 */
router.post('/reactivate', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    if (!isStripeBillingConfigured()) {
      return res.status(503).json({
        error: 'billing_not_configured',
        message: 'Soverm Pro billing is not available yet.',
      })
    }

    await ensureUserExists(userId)
    const access = await reactivateProSubscription({ userId })

    res.json({
      success: true,
      cancelAtPeriodEnd: access.cancelAtPeriodEnd,
      currentPeriodEnd: access.currentPeriodEnd,
      proAccessEndsAt: access.proAccessEndsAt,
    })
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 503) {
      return res.status(err.statusCode).json({ error: err.message })
    }

    reportServerError('to reactivate Soverm Pro subscription', err, { userId, req })
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
