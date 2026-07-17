/*
 * getHealthCheck
 *
 * What it does:
 * - Confirms the API is up
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
    integrations: {
      email: integrations.email.configured,
      stripe: integrations.stripe.configured,
    },
  })
}
