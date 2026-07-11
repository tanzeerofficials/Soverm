/*
 * STRIPE BILLING HELPERS
 *
 * Creates Checkout sessions for Soverm Pro and applies webhook events
 * to users.subscription_tier.
 */

import Stripe from 'stripe'
import db from '../db/index.js'
import { PRO_MONTHLY_PRICE } from '../shared/usageLimits.js'

let stripeClient = null

export function isStripeBillingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_WEBHOOK_SECRET
  )
}

export function getStripeClient() {
  if (!isStripeBillingConfigured()) {
    return null
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
  }

  return stripeClient
}

function appBaseUrl() {
  const raw = process.env.APP_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173'
  return raw.replace(/\/$/, '')
}

/**
 * Starts a Stripe Checkout session for monthly Pro.
 *
 * What it does:
 * - Reuses or creates a Stripe customer linked to the Clerk user id
 * - Opens a subscription Checkout session for STRIPE_PRICE_ID
 *
 * Why we need it:
 * - Paywall / pricing CTAs need a real checkout URL instead of "coming soon"
 */
export async function createProCheckoutSession({ userId, email }) {
  const stripe = getStripeClient()
  if (!stripe) {
    const error = new Error('Stripe billing is not configured')
    error.statusCode = 503
    throw error
  }

  const userResult = await db.query(
    `SELECT id, email, name, subscription_tier, stripe_customer_id
     FROM users
     WHERE id = $1`,
    [userId]
  )

  const user = userResult.rows[0]
  if (!user) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  if (user.subscription_tier === 'pro') {
    const error = new Error('You are already on Soverm Pro')
    error.statusCode = 400
    throw error
  }

  let customerId = user.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email || user.email,
      name: user.name || undefined,
      metadata: { clerkUserId: userId },
    })
    customerId = customer.id
    await db.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [
      customerId,
      userId,
    ])
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${appBaseUrl()}/settings?billing=success`,
    cancel_url: `${appBaseUrl()}/settings?billing=canceled`,
    client_reference_id: userId,
    metadata: { clerkUserId: userId },
    subscription_data: {
      metadata: { clerkUserId: userId },
    },
    allow_promotion_codes: true,
  })

  return {
    url: session.url,
    sessionId: session.id,
    monthlyPrice: PRO_MONTHLY_PRICE,
  }
}

export async function setUserProFromStripe({
  userId,
  customerId,
  subscriptionId,
}) {
  if (!userId) {
    return { updated: false }
  }

  await db.query(
    `UPDATE users
     SET subscription_tier = 'pro',
         stripe_customer_id = COALESCE($2, stripe_customer_id),
         stripe_subscription_id = COALESCE($3, stripe_subscription_id)
     WHERE id = $1`,
    [userId, customerId ?? null, subscriptionId ?? null]
  )

  return { updated: true }
}

export async function setUserFreeFromStripe({ userId, customerId, subscriptionId }) {
  if (userId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL
       WHERE id = $1`,
      [userId]
    )
    return { updated: true }
  }

  if (subscriptionId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL
       WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    )
    return { updated: true }
  }

  if (customerId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL
       WHERE stripe_customer_id = $1`,
      [customerId]
    )
    return { updated: true }
  }

  return { updated: false }
}

export async function resolveClerkUserIdFromStripeObject(object) {
  const fromMeta = object?.metadata?.clerkUserId || object?.client_reference_id
  if (fromMeta) {
    return fromMeta
  }

  const customerId =
    typeof object?.customer === 'string' ? object.customer : object?.customer?.id

  if (!customerId) {
    return null
  }

  const result = await db.query(
    `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId]
  )

  return result.rows[0]?.id ?? null
}
