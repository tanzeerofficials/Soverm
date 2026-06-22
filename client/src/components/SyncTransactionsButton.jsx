/*
 * SYNC TRANSACTIONS BUTTON
 *
 * This button asks our backend to pull the latest transactions
 * from Plaid for every bank account the user has connected.
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { dashboardQueryKey } from '../lib/queryKeys.js'

function SyncTransactionsButton({ className = '', showToast }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/sync-transactions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync transactions')
      }

      showToast?.(
        `Synced ${data.added} new, ${data.modified} updated, ${data.removed} removed`,
        'success'
      )
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (err) {
      console.error('Sync failed:', err.message)
      showToast?.('Sync failed — please try again', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading}
      className={`rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? 'Syncing...' : 'Sync Transactions'}
    </button>
  )
}

export default SyncTransactionsButton
