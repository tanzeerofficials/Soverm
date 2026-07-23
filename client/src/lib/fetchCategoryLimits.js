import { authHeaders } from './apiRequest.js'

export async function fetchCategoryLimits(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/category-limits`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    throw new Error(`Category limits fetch failed: ${res.status}`)
  }

  const data = await res.json()
  return data.limits ?? []
}

export async function upsertCategoryLimit(getToken, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/category-limits`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Category limit save failed: ${res.status}`)
  }

  return data.limit
}

export async function deleteCategoryLimit(getToken, limitId) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/category-limits/${limitId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Category limit delete failed: ${res.status}`)
  }
}
