import { authHeaders } from './apiRequest.js'

export async function fetchCashFlowForecast(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/forecast`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Forecast fetch failed: ${res.status}`)
  }

  return res.json()
}
