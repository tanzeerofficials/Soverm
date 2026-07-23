/*
 * Confirms Email / Stripe integration status helpers used at boot and /health.
 *
 * Usage: node scripts/test-integration-config.js
 */

import assert from 'node:assert/strict'
import {
  getIntegrationConfigStatus,
  isStripeConfigured,
  isTransactionalEmailConfigured,
  logIntegrationConfigStatus,
} from '../utils/integrationConfig.js'
import { test } from 'node:test'

const saved = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
}

function restore() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

test('integration config', () => {
try {
  console.log('integrationConfig tests\n')

  delete process.env.RESEND_API_KEY
  delete process.env.MAIL_FROM
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_PRICE_ID
  delete process.env.STRIPE_WEBHOOK_SECRET

  assert.equal(isTransactionalEmailConfigured(), false, 'email off when empty')
  assert.equal(isStripeConfigured(), false, 'stripe off when empty')

  process.env.RESEND_API_KEY = 're_test'
  process.env.MAIL_FROM = 'Soverm <hello@example.com>'
  process.env.STRIPE_SECRET_KEY = 'sk_test'
  process.env.STRIPE_PRICE_ID = 'price_x'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'

  assert.equal(isTransactionalEmailConfigured(), true, 'email on when both set')
  assert.equal(isStripeConfigured(), true, 'stripe on when all three set')

  const status = getIntegrationConfigStatus()
  assert.equal(status.email.configured, true)
  assert.equal(status.stripe.configured, true)

  delete process.env.MAIL_FROM
  assert.equal(isTransactionalEmailConfigured(), false, 'email needs MAIL_FROM')

  const logged = logIntegrationConfigStatus({ isProduction: false })
  assert.equal(logged.email.configured, false)
  assert.equal(logged.stripe.configured, true)

  console.log('  pass: email + stripe configured flags')
  console.log('\nAll integrationConfig tests passed.')
} finally {
  restore()
}
})
