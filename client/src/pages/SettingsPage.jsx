/*
 * SETTINGS PAGE
 *
 * Account management: connected banks, plan/usage, and permanent deletion.
 */

import { useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import UsageBadge from '../components/UsageBadge.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import { disconnectAccount } from '../lib/disconnectAccount.js'
import { deleteAccount } from '../lib/deleteAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { dashboardQueryKey, usageQueryKey } from '../lib/queryKeys.js'
import { getDisplayBalance } from '../lib/balanceHelpers.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function SettingsPage() {
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()

  const [accountToDelete, setAccountToDelete] = useState(null)
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const { data: usage } = useQuery({
    queryKey: usageQueryKey,
    queryFn: () => fetchUsage(getToken),
  })

  const { data: dashboardData, isPending: accountsLoading } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Dashboard fetch failed: ${res.status}`)
      }
      return res.json()
    },
  })

  const accounts = dashboardData?.accounts ?? []

  async function handleDisconnectConfirm() {
    if (!accountToDelete) return

    const accountId = accountToDelete.id
    const accountName = accountToDelete.account_name

    try {
      await disconnectAccount(getToken, accountId)
      setAccountToDelete(null)
      showToast(`"${accountName}" disconnected`, 'success')
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (err) {
      console.error('Failed to disconnect account:', err.message)
      showToast('Failed to disconnect account — please try again', 'error')
    }
  }

  async function handleDeleteAccountConfirm() {
    if (isDeletingAccount) return

    setIsDeletingAccount(true)

    try {
      await deleteAccount(getToken)
      setShowDeleteAccountModal(false)
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Failed to delete account:', err.message)
      showToast('Failed to delete account — please try again', 'error')
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        leftContent={
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              to="/dashboard"
              className="shrink-0 text-xs text-[#9CA3AF] transition hover:text-white sm:text-sm"
            >
              ← Dashboard
            </Link>
            <span className="truncate text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]">
              Soverm
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#F9FAFB]">Settings</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Manage your plan, connected banks, and account data.
          </p>
        </div>

        <section className="rounded-xl border border-[#1E2D45] bg-[#111827] p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
            Your plan
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-lg font-semibold text-[#F9FAFB]">
              {usage?.isPro ? 'Soverm Pro' : 'Free'}
            </p>
            <UsageBadge usage={usage} />
            {usage && !usage.isPro && (
              <p className="text-xs text-[#6B7280]">
                {usage.generatedToday ?? 0} insight
                {(usage.generatedToday ?? 0) === 1 ? '' : 's'} generated today
              </p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-[#1E2D45] bg-[#111827] p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
            Connected banks
          </h2>

          {accountsLoading ? (
            <p className="mt-4 text-sm text-[#9CA3AF]">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#1E2D45] px-4 py-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No banks connected yet.</p>
              <Link
                to="/dashboard"
                className="mt-3 inline-block text-sm font-medium text-[#10B981] transition hover:text-emerald-400"
              >
                Connect a bank on your dashboard
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#1E2D45] bg-[#1A2236] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                      {account.bank_name}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[#F9FAFB]">
                      {account.account_name}
                    </p>
                    <p className="mt-2 font-mono text-sm text-[#10B981]">
                      {formatCurrency(getDisplayBalance(account))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountToDelete(account)}
                    className="min-h-11 shrink-0 rounded-lg border border-[#1E2D45] px-3 py-2 text-xs font-medium text-[#9CA3AF] transition hover:border-red-500/40 hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-red-500/30 bg-[#111827] p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-red-400">
            Danger zone
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#9CA3AF]">
            Permanently delete your Soverm account, all connected banks, transactions,
            insights, and chat history. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteAccountModal(true)}
            className="mt-4 min-h-11 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
          >
            Delete my account
          </button>
        </section>
      </main>

      <ConfirmModal
        isOpen={!!accountToDelete}
        title="Disconnect this account?"
        message={`This will stop syncing "${accountToDelete?.account_name}". Your transaction history will be kept.`}
        confirmLabel="Disconnect"
        onCancel={() => setAccountToDelete(null)}
        onConfirm={handleDisconnectConfirm}
      />

      <ConfirmModal
        isOpen={showDeleteAccountModal}
        title="Delete your account permanently?"
        message="This will immediately and permanently delete your Soverm account, all connected bank links, transactions, AI insights, chat history, and usage data. You will be signed out and cannot recover this data."
        confirmLabel="Delete my account"
        confirmationPhrase="DELETE"
        isConfirming={isDeletingAccount}
        onCancel={() => {
          if (!isDeletingAccount) {
            setShowDeleteAccountModal(false)
          }
        }}
        onConfirm={handleDeleteAccountConfirm}
      />
    </div>
  )
}

export default SettingsPage
