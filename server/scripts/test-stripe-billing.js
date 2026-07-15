/*
 * Unit tests for Stripe billing helpers (no live Stripe required).
 *
 * Usage: node scripts/test-stripe-billing.js
 */

import assert from 'node:assert/strict'
import {
  cancelStripeSubscriptionsForUser,
  isStripeBillingConfigured,
  tierFromSubscriptionStatus,
} from '../services/stripeBilling.js'

let passed = 0

function pass(label) {
  console.log(`  pass: ${label}`)
  passed += 1
}

console.log('Stripe billing tests\n')

// 1) Configured requires all three env vars
{
  const prev = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  }

  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_PRICE_ID
  delete process.env.STRIPE_WEBHOOK_SECRET
  assert.equal(isStripeBillingConfigured(), false, 'empty env → not configured')

  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
  process.env.STRIPE_PRICE_ID = 'price_x'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
  assert.equal(isStripeBillingConfigured(), true, 'all three set → configured')

  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  pass('isStripeBillingConfigured env guards')
}

// 2) Subscription status → tier mapping
{
  assert.equal(tierFromSubscriptionStatus('active'), 'pro')
  assert.equal(tierFromSubscriptionStatus('trialing'), 'pro')
  assert.equal(tierFromSubscriptionStatus('canceled'), 'free')
  assert.equal(tierFromSubscriptionStatus('unpaid'), 'free')
  assert.equal(tierFromSubscriptionStatus('incomplete_expired'), 'free')
  assert.equal(tierFromSubscriptionStatus('past_due'), null)
  assert.equal(tierFromSubscriptionStatus('incomplete'), null)
  pass('tierFromSubscriptionStatus mapping')
}

// 3) cancel helper skips when stripe is null
{
  const skipped = await cancelStripeSubscriptionsForUser('user_1', { stripe: null })
  assert.equal(skipped.skipped, true)
  assert.equal(skipped.canceled, 0)
  pass('cancelStripeSubscriptionsForUser skips when stripe null')
}

// 4) cancel helper cancels DB subscription id + active listed subs
{
  const canceledIds = []
  const fakeDb = {
    query: async () => ({
      rows: [
        {
          stripe_customer_id: 'cus_1',
          stripe_subscription_id: 'sub_from_db',
        },
      ],
    }),
  }
  const fakeStripe = {
    subscriptions: {
      list: async () => ({
        data: [
          { id: 'sub_listed', status: 'active' },
          { id: 'sub_old', status: 'canceled' },
        ],
      }),
      cancel: async (id) => {
        canceledIds.push(id)
        return { id, status: 'canceled' }
      },
    },
  }

  const result = await cancelStripeSubscriptionsForUser('user_1', {
    stripe: fakeStripe,
    db: fakeDb,
  })

  assert.equal(result.skipped, false)
  assert.equal(result.canceled, 2)
  assert.deepEqual(canceledIds.sort(), ['sub_from_db', 'sub_listed'].sort())
  pass('cancelStripeSubscriptionsForUser cancels DB + active listed subs')
}

// 5) Stripe cancel failures do not throw
{
  const fakeDb = {
    query: async () => ({
      rows: [{ stripe_customer_id: null, stripe_subscription_id: 'sub_bad' }],
    }),
  }
  const fakeStripe = {
    subscriptions: {
      list: async () => ({ data: [] }),
      cancel: async () => {
        throw new Error('Stripe down')
      },
    },
  }

  const result = await cancelStripeSubscriptionsForUser('user_1', {
    stripe: fakeStripe,
    db: fakeDb,
  })
  assert.equal(result.canceled, 0)
  assert.equal(result.skipped, false)
  pass('cancelStripeSubscriptionsForUser swallows Stripe cancel errors')
}

console.log(`\n${passed}/${passed} stripe billing tests passed.`)
