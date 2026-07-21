/*
 * getHealthCheck
 *
 * What it does:
 * - Confirms the API is up
 * - Reports NODE_ENV / Railway environment (no secrets) so ops can confirm
 *   production is not running with a missing NODE_ENV
 * - Reports whether optional Email (Resend) and Stripe are configured
 *   (booleans only — never secrets)
 *
 * Why we need it:
 * - Uptime monitors + pre-launch checks: "is email actually wired?"
 *   without digging through Railway env UI.
 */

import { getIntegrationConfigStatus } from '../utils/integrationConfig.js'

export function getHealthCheck(_req, res) {
  const integrations = getIntegrationConfigStatus()

  res.json({
    message: 'CFO Agent API is running',
    nodeEnv: process.env.NODE_ENV || null,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT || null,
    integrations: {
      email: integrations.email.configured,
      stripe: integrations.stripe.configured,
    },
  })
}
