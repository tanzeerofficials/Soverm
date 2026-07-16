/*
 * STRIPE BILLING HELPERS
 *
 * Creates Checkout / Customer Portal sessions for Soverm Pro and applies
 * webhook events to users.subscription_tier. Also cancels Stripe
 * subscriptions when a user deletes their account.
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

/**
 * Maps a Stripe subscription status to our app tier.
 *
 * What it does: returns 'pro' for billable statuses, 'free' for ended/failed,
 * and null when we should leave the DB tier unchanged (e.g. past_due).
 *
 * Why: webhooks and unit tests need one shared rule so cancel / unpaid
 * always demote consistently.
 */
export function tierFromSubscriptionStatus(status) {
  if (status === 'active' || status === 'trialing') {
    return 'pro'
  }

  if (
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired'
  ) {
    return 'free'
  }

  return null
}

/*
 * What this does: reads cancel_at_period_end + period end from a Stripe
 * subscription so Profile can show "Pro until {date}" after a portal cancel.
 *
 * Why: Stripe keeps status=active until the paid period ends; we stay Pro but
 * users need to see when access actually ends.
 *
 * Note: newer Stripe API versions may put current_period_end on subscription
 * items instead of the top-level subscription — we check both, plus cancel_at.
 */
export function subscriptionAccessFromStripe(subscription) {
  if (!subscription || typeof subscription !== 'object') {
    return {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    }
  }

  const status = subscription.status
  const isActiveLike = status === 'active' || status === 'trialing'
  const cancelAtUnix = Number(subscription.cancel_at)

  // Portal "cancel at period end" sets cancel_at_period_end; some configs only set cancel_at.
  const cancelAtPeriodEnd =
    Boolean(subscription.cancel_at_period_end) ||
    (isActiveLike && Number.isFinite(cancelAtUnix) && cancelAtUnix > 0)

  const currentPeriodEnd = readSubscriptionPeriodEndIso(subscription)

  return {
    cancelAtPeriodEnd,
    currentPeriodEnd,
  }
}

function readSubscriptionPeriodEndIso(subscription) {
  const candidates = [
    Number(subscription.current_period_end),
    Number(subscription.cancel_at),
  ]

  const items = subscription.items?.data
  if (Array.isArray(items)) {
    for (const item of items) {
      candidates.push(Number(item?.current_period_end))
    }
  }

  for (const endUnix of candidates) {
    if (Number.isFinite(endUnix) && endUnix > 0) {
      return new Date(endUnix * 1000).toISOString()
    }
  }

  return null
}

function appBaseUrl() {
  const raw = process.env.APP_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173'
  return raw.replace(/\/$/, '')
}

function billingNotConfiguredError() {
  const error = new Error('Stripe billing is not configured')
  error.statusCode = 503
  return error
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
    throw billingNotConfiguredError()
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

/**
 * Opens Stripe's Customer Portal so Pro users can update payment methods
 * or cancel — matches "cancel anytime" in Terms.
 *
 * What it does: creates a short-lived portal session URL for the user's
 * Stripe customer and returns them to /settings when done.
 *
 * Why: Checkout only handles upgrade; manage/cancel must go through Portal.
 */
export async function createBillingPortalSession({ userId }) {
  const stripe = getStripeClient()
  if (!stripe) {
    throw billingNotConfiguredError()
  }

  const userResult = await db.query(
    `SELECT id, subscription_tier, stripe_customer_id
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

  if (user.subscription_tier !== 'pro') {
    const error = new Error('Soverm Pro is required to manage billing')
    error.statusCode = 400
    throw error
  }

  if (!user.stripe_customer_id) {
    const error = new Error('No Stripe customer on file for this account')
    error.statusCode = 400
    throw error
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appBaseUrl()}/settings`,
  })

  return {
    url: session.url,
  }
}

/*
 * What this does: turns off cancel_at_period_end on the user's Stripe subscription.
 * Why: after a portal cancel, Profile needs a one-tap "Keep Pro / Resubscribe"
 * without hunting for Renew in the Stripe portal UI.
 */
export async function reactivateProSubscription({ userId }) {
  const stripe = getStripeClient()
  if (!stripe) {
    throw billingNotConfiguredError()
  }

  const userResult = await db.query(
    `SELECT id, subscription_tier, stripe_customer_id, stripe_subscription_id
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

  if (user.subscription_tier !== 'pro') {
    const error = new Error('Soverm Pro is required to renew')
    error.statusCode = 400
    throw error
  }

  const subscription = await resolveActiveSubscription(stripe, user)
  if (!subscription) {
    const error = new Error('No active Stripe subscription found to renew')
    error.statusCode = 400
    throw error
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: false,
  })
  const access = subscriptionAccessFromStripe(updated)

  await setUserProFromStripe({
    userId,
    customerId: user.stripe_customer_id,
    subscriptionId: updated.id,
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd,
  })

  return {
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd,
    proAccessEndsAt: null,
  }
}

async function resolveActiveSubscription(stripe, user) {
  if (user.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id, {
        expand: ['items.data'],
      })
      if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
        return subscription
      }
    } catch (err) {
      console.warn('Stripe subscription retrieve failed:', err.message)
    }
  }

  if (!user.stripe_customer_id) {
    return null
  }

  const listed = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'all',
    limit: 10,
    expand: ['data.items.data'],
  })

  return (
    listed.data.find((row) => row.status === 'active' || row.status === 'trialing') ?? null
  )
}

/**
 * Cancels active Stripe subscriptions for a user who is deleting their account.
 *
 * What it does: looks up stripe_subscription_id / stripe_customer_id, cancels
 * immediately so Stripe stops charging after the account is gone.
 *
 * Why: deleting app rows alone leaves a live Stripe subscription.
 * Errors are logged and swallowed so a Stripe outage never blocks deletion.
 *
 * @param {string} userId
 * @param {{ stripe?: import('stripe').Stripe | null, db?: { query: Function } }} [deps]
 */
export async function cancelStripeSubscriptionsForUser(userId, deps = {}) {
  const stripe = deps.stripe !== undefined ? deps.stripe : getStripeClient()
  const database = deps.db ?? db
  if (!stripe || !userId) {
    return { canceled: 0, skipped: true }
  }

  const userResult = await database.query(
    `SELECT stripe_customer_id, stripe_subscription_id
     FROM users
     WHERE id = $1`,
    [userId]
  )
  const user = userResult.rows[0]
  if (!user) {
    return { canceled: 0, skipped: true }
  }

  const subscriptionIds = new Set()
  if (user.stripe_subscription_id) {
    subscriptionIds.add(user.stripe_subscription_id)
  }

  if (user.stripe_customer_id) {
    try {
      const list = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all',
        limit: 20,
      })
      for (const subscription of list.data ?? []) {
        if (
          subscription.status === 'active' ||
          subscription.status === 'trialing' ||
          subscription.status === 'past_due' ||
          subscription.status === 'unpaid'
        ) {
          subscriptionIds.add(subscription.id)
        }
      }
    } catch (err) {
      console.error(
        'Stripe subscriptions.list failed during account deletion:',
        err.message
      )
    }
  }

  let canceled = 0
  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId)
      canceled += 1
    } catch (err) {
      console.error(
        `Stripe subscriptions.cancel failed for ${subscriptionId}:`,
        err.message
      )
    }
  }

  return { canceled, skipped: false }
}

export async function setUserProFromStripe({
  userId,
  customerId,
  subscriptionId,
  cancelAtPeriodEnd = false,
  currentPeriodEnd = null,
}) {
  if (!userId) {
    return { updated: false }
  }

  await db.query(
    `UPDATE users
     SET subscription_tier = 'pro',
         stripe_customer_id = COALESCE($2, stripe_customer_id),
         stripe_subscription_id = COALESCE($3, stripe_subscription_id),
         stripe_cancel_at_period_end = $4,
         stripe_current_period_end = $5::timestamptz
     WHERE id = $1`,
    [
      userId,
      customerId ?? null,
      subscriptionId ?? null,
      Boolean(cancelAtPeriodEnd),
      currentPeriodEnd,
    ]
  )

  return { updated: true }
}

export async function setUserFreeFromStripe({ userId, customerId, subscriptionId }) {
  if (userId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL,
           stripe_cancel_at_period_end = false,
           stripe_current_period_end = NULL
       WHERE id = $1`,
      [userId]
    )
    return { updated: true }
  }

  if (subscriptionId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL,
           stripe_cancel_at_period_end = false,
           stripe_current_period_end = NULL
       WHERE stripe_subscription_id = $1`,
      [subscriptionId]
    )
    return { updated: true }
  }

  if (customerId) {
    await db.query(
      `UPDATE users
       SET subscription_tier = 'free',
           stripe_subscription_id = NULL,
           stripe_cancel_at_period_end = false,
           stripe_current_period_end = NULL
       WHERE stripe_customer_id = $1`,
      [customerId]
    )
    return { updated: true }
  }

  return { updated: false }
}

/*
 * What this does: loads stored cancel/period-end fields, and for Pro users
 * refreshes them from Stripe when we have a subscription id (portal cancel
 * may land before the webhook).
 */
export async function getBillingAccessStatus(userId) {
  const result = await db.query(
    `SELECT subscription_tier,
            stripe_customer_id,
            stripe_subscription_id,
            stripe_cancel_at_period_end,
            stripe_current_period_end
     FROM users
     WHERE id = $1`,
    [userId]
  )

  const row = result.rows[0]
  if (!row) {
    return {
      tier: 'free',
      isPro: false,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      proAccessEndsAt: null,
      hasStripeCustomer: false,
    }
  }

  let cancelAtPeriodEnd = Boolean(row.stripe_cancel_at_period_end)
  let currentPeriodEnd = row.stripe_current_period_end
    ? new Date(row.stripe_current_period_end).toISOString()
    : null

  const tier = row.subscription_tier ?? 'free'
  const isPro = tier === 'pro'
  const hasStripeCustomer = Boolean(row.stripe_customer_id)
  const stripe = getStripeClient()

  if (isPro && stripe && (row.stripe_subscription_id || row.stripe_customer_id)) {
    try {
      const subscription = await resolveActiveSubscription(stripe, row)
      if (subscription) {
        const access = subscriptionAccessFromStripe(subscription)
        cancelAtPeriodEnd = access.cancelAtPeriodEnd
        currentPeriodEnd = access.currentPeriodEnd ?? currentPeriodEnd

        await db.query(
          `UPDATE users
           SET stripe_subscription_id = COALESCE($2, stripe_subscription_id),
               stripe_cancel_at_period_end = $3,
               stripe_current_period_end = $4::timestamptz
           WHERE id = $1`,
          [userId, subscription.id, cancelAtPeriodEnd, currentPeriodEnd]
        )
      }
    } catch (err) {
      console.warn('Stripe subscription retrieve for billing status failed:', err.message)
    }
  }

  const proAccessEndsAt =
    isPro && cancelAtPeriodEnd && currentPeriodEnd ? currentPeriodEnd : null

  return {
    tier,
    isPro,
    cancelAtPeriodEnd: isPro ? cancelAtPeriodEnd : false,
    currentPeriodEnd: isPro ? currentPeriodEnd : null,
    proAccessEndsAt,
    hasStripeCustomer,
  }
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
