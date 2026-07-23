/*
 * DISCONNECT ACCOUNT
 *
 * Shared API call and confirmation copy for removing a linked bank account.
 * Used by the dashboard and settings page.
 */

import { authHeaders } from './apiRequest.js'

export function getDisconnectConfirmMessage(accountName) {
  return `This will stop syncing "${accountName}" and remove it from your Expense Analyzer and category breakdowns. Your past insights and transaction history are kept for future tracking.`
}

export async function disconnectAccount(getToken, accountId) {
  const token = await getToken()
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/plaid/accounts/${accountId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to disconnect account')
  }

  return response.json()
}
