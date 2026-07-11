/*
 * START PRO CHECKOUT
 *
 * Asks our API for a Stripe Checkout URL, then sends the browser there.
 *
 * What it does:
 * - POSTs to /api/billing/checkout with the user's Clerk token
 * - On success, redirects window.location to Stripe's hosted page
 *
 * Why we need it:
 * - Pricing, paywall, history, and settings all share one upgrade path
 * - Keeps Stripe secrets on the server; the client only opens the returned URL
 *
 * Important concept: Checkout is hosted by Stripe. After payment, Stripe
 * webhooks update subscription_tier in our database — not the success page alone.
 */

export async function startProCheckout(getToken, { email } = {}) {
  const token = await getToken()
  if (!token) {
    const error = new Error('Please sign in to upgrade')
    error.code = 'not_signed_in'
    throw error
  }

  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(email ? { email } : {}),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(
      data.message || data.error || `Checkout failed (${res.status})`
    )
    error.code = data.error || 'checkout_failed'
    error.status = res.status
    throw error
  }

  if (!data.url) {
    throw new Error('Checkout session did not return a URL')
  }

  window.location.assign(data.url)
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
