import { authHeaders } from './apiRequest.js'

export async function syncTransactions(getToken) {
  const token = await getToken()
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/sync-transactions`, {
    method: 'POST',
    headers: authHeaders(token),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to sync transactions')
  }

  return data
}
