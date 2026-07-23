import { authHeaders } from './apiRequest.js'

export async function fetchWeeklyReview(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/weekly-review`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Weekly review fetch failed: ${res.status}`)
  }

  return res.json()
}
