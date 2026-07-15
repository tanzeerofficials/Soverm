/*
 * BILLING STATUS
 *
 * Loads whether Stripe checkout is configured and the user's plan tier.
 */

import { fetchUsage } from './fetchUsage.js'

export async function fetchBillingStatus(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not signed in')
  }

  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Billing status failed (${res.status})`)
  }

  return res.json()
}

/**
 * After Checkout success, Stripe webhooks may lag a few seconds.
 * Poll usage until isPro (or timeout) so Settings can confirm Pro unlocked.
 */
export async function waitForProUnlock(getToken, { timeoutMs = 10000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const usage = await fetchUsage(getToken)
      if (usage?.isPro) {
        return { unlocked: true, usage }
      }
    } catch {
      // Keep polling through transient errors.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return { unlocked: false, usage: null }
}
