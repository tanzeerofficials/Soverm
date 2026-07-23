/*
 * DELETE ACCOUNT
 *
 * Permanently deletes the signed-in user's Soverm data and Clerk account.
 */

import { authHeaders } from './apiRequest.js'

export async function deleteAccount(getToken) {
  const token = await getToken()
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to delete account')
  }

  return response.json()
}
