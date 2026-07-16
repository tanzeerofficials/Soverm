/*
 * STRIPE WEBHOOKS
 *
 * Mounted with express.raw so Stripe signature verification works.
 * Updates users.subscription_tier when Checkout completes or a subscription ends.
 */

import { Router } from 'express'
import {
  getStripeClient,
  isStripeBillingConfigured,
  resolveClerkUserIdFromStripeObject,
  setUserFreeFromStripe,
  setUserProFromStripe,
  subscriptionAccessFromStripe,
  tierFromSubscriptionStatus,
} from '../services/stripeBilling.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.post('/', async (req, res) => {
  if (!isStripeBillingConfigured()) {
    return res.status(503).json({ error: 'Stripe billing is not configured' })
  }

  const stripe = getStripeClient()
  const signature = req.headers['stripe-signature']

  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    reportServerError('to verify Stripe webhook', err, { req })
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') {
          break
        }

        const userId = await resolveClerkUserIdFromStripeObject(session)
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id

        await setUserProFromStripe({ userId, customerId, subscriptionId })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = await resolveClerkUserIdFromStripeObject(subscription)
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id
        const status = subscription.status
        const tier = tierFromSubscriptionStatus(status)

        if (tier === 'pro') {
          const access = subscriptionAccessFromStripe(subscription)
          await setUserProFromStripe({
            userId,
            customerId,
            subscriptionId: subscription.id,
            cancelAtPeriodEnd: access.cancelAtPeriodEnd,
            currentPeriodEnd: access.currentPeriodEnd,
          })
        } else if (tier === 'free') {
          await setUserFreeFromStripe({
            userId,
            customerId,
            subscriptionId: subscription.id,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = await resolveClerkUserIdFromStripeObject(subscription)
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id

        await setUserFreeFromStripe({
          userId,
          customerId,
          subscriptionId: subscription.id,
        })
        break
      }

      default:
        break
    }

    res.json({ received: true })
  } catch (err) {
    reportServerError('to process Stripe webhook', err, { req })
    res.status(500).json({ error: 'Failed to process webhook' })
  }
})

export default router
