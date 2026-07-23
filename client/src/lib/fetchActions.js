import { authHeaders } from './apiRequest.js'

export async function createClosedLoopAction(getToken, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/actions`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Action create failed: ${res.status}`)
  }

  return data.action
}

export async function updateActionLifecycle(getToken, actionId, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/actions/${actionId}`, {
    method: 'PATCH',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Action update failed: ${res.status}`)
  }

  return data.action
}
