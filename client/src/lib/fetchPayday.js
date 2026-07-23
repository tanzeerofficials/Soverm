import { authHeaders } from './apiRequest.js'

export async function fetchPayday(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/payday`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Payday fetch failed: ${res.status}`)
  }

  return res.json()
}

export async function savePayday(getToken, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/payday`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Payday save failed: ${res.status}`)
  }

  return data.payday
}
