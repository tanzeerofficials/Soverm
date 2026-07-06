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
import { syncTransactions } from '../lib/syncTransactions.js'

function SyncTransactionsButton({ className = '', showToast }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)

    try {
      const data = await syncTransactions(getToken)

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
      className={`min-h-11 rounded-lg border border-[#1E2D45] bg-[#111827] px-4 py-3 text-sm font-semibold text-[#F9FAFB] transition hover:border-[#374151] hover:bg-[#1A2236] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? 'Syncing...' : 'Sync Transactions'}
    </button>
  )
}

export default SyncTransactionsButton
