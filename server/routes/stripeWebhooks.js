/*
 * STRIPE WEBHOOKS
 *
 * Mounted with express.raw so Stripe signature verification works.
 * Updates users.subscription_tier when Checkout completes or a subscription ends.
 *
 * Event ids are persisted so Stripe retries / replays do not re-run billing work.
 */

import { Router } from 'express'
import db from '../db/index.js'
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

async function claimStripeEvent(event) {
  try {
    const result = await db.query(
      `INSERT INTO stripe_webhook_events (id, event_type, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [event.id, event.type]
    )
    return { claimed: result.rows.length > 0 }
  } catch (err) {
    // Migration 029 not applied — process without dedup rather than drop webhooks.
    if (err.code === '42P01') {
      console.warn(
        '[stripe-webhook] stripe_webhook_events missing — run migration 029; processing without dedup'
      )
      return { claimed: true, dedupUnavailable: true }
    }
    throw err
  }
}

async function markStripeEventProcessed(eventId) {
  try {
    await db.query(
      `UPDATE stripe_webhook_events
       SET status = 'processed',
           error_message = NULL,
           processed_at = NOW()
       WHERE id = $1`,
      [eventId]
    )
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[stripe-webhook] failed to mark event processed:', err.message)
    }
  }
}

/**
 * Release the claim on failure so Stripe's retry can re-process.
 * Leaving a "failed" row would permanently skip the event.
 */
async function releaseStripeEventClaim(eventId, message) {
  try {
    await db.query(
      `DELETE FROM stripe_webhook_events WHERE id = $1`,
      [eventId]
    )
    if (message) {
      console.warn(
        `[stripe-webhook] released claim for ${eventId} after error: ${message.slice(0, 200)}`
      )
    }
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[stripe-webhook] failed to release event claim:', err.message)
    }
  }
}

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
    const claim = await claimStripeEvent(event)
    if (!claim.claimed) {
      return res.json({ received: true, deduped: true })
    }

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

    await markStripeEventProcessed(event.id)
    res.json({ received: true })
  } catch (err) {
    await releaseStripeEventClaim(event?.id, err.message)
    reportServerError('to process Stripe webhook', err, { req })
    res.status(500).json({ error: 'Failed to process webhook' })
  }
})

export default router
