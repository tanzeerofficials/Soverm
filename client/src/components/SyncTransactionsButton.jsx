/*
 * SYNC TRANSACTIONS BUTTON
 *
 * This button asks our backend to pull the latest transactions
 * from Plaid for every bank account the user has connected.
 *
 * Big picture steps:
 * 1) Get Clerk login token (proves who you are)
 * 2) POST to /api/plaid/sync-transactions
 * 3) Backend syncs each account and inserts new transactions
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

/*
 * SyncTransactionsButton
 *
 * What it does:
 * - Shows a "Sync Transactions" button on the dashboard.
 *
 * Why we need getToken() (same as ConnectBankButton):
 * - Our backend route checks getAuth(req) and returns 401 without a valid token.
 * - Clerk's getToken() gives us the JWT to send as Authorization: Bearer ...
 * - That lets the server know which userId owns the accounts to sync.
 *
 * Important concepts:
 * - useState: tracks loading so we can disable the button while syncing
 * - async/await: network requests take time; await waits for the response
 */
function SyncTransactionsButton({ className = '', showToast, onSyncComplete }) {
  const { getToken } = useAuth()
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
      onSyncComplete?.()
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
