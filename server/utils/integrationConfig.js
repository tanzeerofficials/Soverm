/*
 * OPTIONAL INTEGRATIONS STATUS
 *
 * Email (Resend) and Stripe are optional at boot — the app still runs —
 * but operators need a loud signal when digests/checkout will silently
 * dry-run or return 503. Used at server start and on GET /health.
 */

export function isTransactionalEmailConfigured() {
  return Boolean(
    String(process.env.RESEND_API_KEY || '').trim() &&
      String(process.env.MAIL_FROM || '').trim()
  )
}

export function isStripeConfigured() {
  return Boolean(
    String(process.env.STRIPE_SECRET_KEY || '').trim() &&
      String(process.env.STRIPE_PRICE_ID || '').trim() &&
      String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  )
}

export function getIntegrationConfigStatus() {
  return {
    email: {
      configured: isTransactionalEmailConfigured(),
      requires: ['RESEND_API_KEY', 'MAIL_FROM'],
      effectWhenMissing:
        'Weekly digest and month-letter emails dry-run to server logs; in-app notifications still work.',
    },
    stripe: {
      configured: isStripeConfigured(),
      requires: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'],
      effectWhenMissing:
        'Pro upgrade / billing portal return 503; free tier and the rest of the app keep working.',
    },
  }
}

/*
 * What this does: prints a clear configured / MISSING line for email + Stripe.
 * Why: before heavy testing / prod, you should not discover digests or checkout
 * are off only after a user hits them.
 */
export function logIntegrationConfigStatus({
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  const status = getIntegrationConfigStatus()

  for (const [name, info] of Object.entries(status)) {
    if (info.configured) {
      console.info(`[integrations] ${name}: configured`)
      continue
    }

    const message = `[integrations] ${name}: NOT CONFIGURED (need ${info.requires.join(' + ')}). ${info.effectWhenMissing}`
    if (isProduction) {
      console.warn(message)
    } else {
      console.info(message)
    }
  }

  return status
}
