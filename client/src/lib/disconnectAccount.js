/*
 * DISCONNECT ACCOUNT
 *
 * Shared API call for removing a linked bank account.
 * Used by the dashboard and settings page.
 */

export async function disconnectAccount(getToken, accountId) {
  const token = await getToken()
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/plaid/accounts/${accountId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to disconnect account')
  }

  return response.json()
}
