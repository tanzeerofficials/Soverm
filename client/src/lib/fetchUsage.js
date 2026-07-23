/*
 * USAGE FETCHER
 *
 * Fetches today's free-tier usage (remaining insights, tier)
 * so the dashboard can show the countdown badge and gate the paywall.
 */

import { authHeaders } from './apiRequest.js'

export async function fetchUsage(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/insights/usage`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    throw new Error(`Usage fetch failed: ${res.status}`)
  }

  return res.json()
}
