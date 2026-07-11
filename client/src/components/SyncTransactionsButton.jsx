/*
 * SYNC TRANSACTIONS BUTTON
 *
 * This button asks our backend to pull the latest transactions
 * from Plaid for every bank account the user has connected.
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  invalidateAfterAccountChange,
} from '../lib/queryKeys.js'
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
        data.partial
          ? `Partial sync: ${data.added} new, ${data.modified} updated, ${data.removed} removed — some banks may still be stale`
          : `Synced ${data.added} new, ${data.modified} updated, ${data.removed} removed`,
        data.partial ? 'warning' : 'success'
      )
      await invalidateAfterAccountChange(queryClient)
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
      className={`min-h-11 rounded-lg border border-border-default bg-surface px-4 py-3 text-sm font-semibold text-fg transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? 'Syncing...' : 'Sync Transactions'}
    </button>
  )
}

export default SyncTransactionsButton
