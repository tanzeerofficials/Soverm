/*
 * START PRO CHECKOUT / BILLING PORTAL
 *
 * Asks our API for a Stripe hosted URL, then sends the browser there.
 *
 * What it does:
 * - POSTs to /api/billing/checkout or /api/billing/portal with the Clerk token
 * - On success, redirects window.location to Stripe's hosted page
 *
 * Why we need it:
 * - Pricing, paywall, history, and settings all share one upgrade path
 * - Pro users manage/cancel via Customer Portal (not Checkout)
 * - Keeps Stripe secrets on the server; the client only opens the returned URL
 *
 * Important concept: Checkout / Portal are hosted by Stripe. After payment
 * or cancel, Stripe webhooks update subscription_tier in our database —
 * not the success page alone.
 */

async function postBillingSession(getToken, path, body = {}) {
  const token = await getToken()
  if (!token) {
    const error = new Error('Please sign in to continue')
    error.code = 'not_signed_in'
    throw error
  }

  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(
      data.message || data.error || `Billing request failed (${res.status})`
    )
    error.code = data.error || 'billing_failed'
    error.status = res.status
    throw error
  }

  if (!data.url) {
    throw new Error('Billing session did not return a URL')
  }

  window.location.assign(data.url)
  return data
}

export async function startProCheckout(getToken, { email } = {}) {
  return postBillingSession(
    getToken,
    '/api/billing/checkout',
    email ? { email } : {}
  )
}

/**
 * Opens Stripe Customer Portal for Pro users (update card / cancel).
 */
export async function openBillingPortal(getToken) {
  return postBillingSession(getToken, '/api/billing/portal')
}

/**
 * Clears a scheduled cancel so Pro keeps renewing (still inside paid period).
 */
export async function reactivateProSubscription(getToken) {
  const token = await getToken()
  if (!token) {
    const error = new Error('Please sign in to continue')
    error.code = 'not_signed_in'
    throw error
  }

  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/reactivate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(
      data.message || data.error || `Couldn’t renew Pro (${res.status})`
    )
    error.code = data.error || 'billing_failed'
    error.status = res.status
    throw error
  }

  return data
}

export function checkoutErrorToastMessage(err) {
  if (err?.code === 'billing_not_configured' || err?.status === 503) {
    return 'Soverm Pro checkout is not available yet — please try again later'
  }
  if (err?.code === 'not_signed_in') {
    return 'Sign in to upgrade to Soverm Pro'
  }
  if (typeof err?.message === 'string' && err.message.includes('already on Soverm Pro')) {
    return 'You are already on Soverm Pro'
  }
  return 'Couldn’t start checkout — please try again'
}

export function portalErrorToastMessage(err) {
  if (err?.code === 'billing_not_configured' || err?.status === 503) {
    return 'Billing management is not available yet — please try again later'
  }
  if (err?.code === 'not_signed_in') {
    return 'Sign in to manage billing'
  }
  if (
    typeof err?.message === 'string' &&
    err.message.includes('Soverm Pro is required')
  ) {
    return 'Upgrade to Soverm Pro to manage billing'
  }
  return 'Couldn’t open billing portal — please try again'
}

export function reactivateErrorToastMessage(err) {
  if (err?.code === 'billing_not_configured' || err?.status === 503) {
    return 'Billing is not available yet — please try again later'
  }
  if (err?.code === 'not_signed_in') {
    return 'Sign in to renew Soverm Pro'
  }
  return 'Couldn’t renew Pro — open Manage billing or try again'
}
