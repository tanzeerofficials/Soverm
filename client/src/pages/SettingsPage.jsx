/*
 * SETTINGS PAGE
 *
 * Account management: connected banks, plan/usage, and permanent deletion.
 */

import { useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SettingsSection from '../components/SettingsSection.jsx'
import Skeleton from '../components/Skeleton.jsx'
import UsageBadge from '../components/UsageBadge.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import { disconnectAccount, getDisconnectConfirmMessage } from '../lib/disconnectAccount.js'
import { deleteAccount } from '../lib/deleteAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { fetchNotifications, updateNotificationPreferences } from '../lib/fetchNotifications.js'
import { dashboardQueryKey, notificationsQueryKey, usageQueryKey } from '../lib/queryKeys.js'
import { getDisplayBalance } from '../lib/balanceHelpers.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function SettingsAccountSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex items-start justify-between gap-3 rounded-xl border border-border-default bg-surface-elevated p-4"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  )
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

  const { data: notificationData } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchNotifications(getToken),
  })

  const proactiveEnabled = notificationData?.preferences?.proactiveEnabled ?? true

  const preferencesMutation = useMutation({
    mutationFn: (enabled) =>
      updateNotificationPreferences(getToken, { proactiveEnabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
    onError: () => {
      showToast('Couldn’t update notification settings — please try again', 'error')
    },
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
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader
          title="Settings"
          description="Manage your plan, connected banks, notifications, and account data."
        />

        <div className="space-y-8">
          <SettingsSection title="Your plan">
            <div className="flex flex-col gap-3">
              <p className="text-lg font-semibold text-fg">
                {usage?.isPro ? 'Soverm Pro' : 'Free'}
              </p>
              <UsageBadge usage={usage} />
              {usage && !usage.isPro && (
                <p className="text-xs text-fg-subtle">
                  {usage.generatedToday ?? 0} insight
                  {(usage.generatedToday ?? 0) === 1 ? '' : 's'} generated today
                </p>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Proactive alerts</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                  Soverm flags unusual charges, low balance, new subscriptions, and spending
                  spikes after each sync. Alerts appear in the bell icon and on your dashboard.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={proactiveEnabled}
                aria-label="Proactive alerts"
                disabled={preferencesMutation.isPending}
                onClick={() => preferencesMutation.mutate(!proactiveEnabled)}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-60 ${
                  proactiveEnabled ? 'bg-brand' : 'bg-surface-elevated ring-1 ring-border-default'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                    proactiveEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {!proactiveEnabled && (
              <p className="mt-3 text-xs text-fg-subtle">
                Paused — you won&apos;t receive new alerts until you turn this back on. Existing
                notifications stay in your history.
              </p>
            )}
          </SettingsSection>

          <SettingsSection title="Connected banks">
            {accountsLoading ? (
              <SettingsAccountSkeleton />
            ) : accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-default px-4 py-8 text-center">
                <p className="text-sm text-fg-muted">No banks connected yet.</p>
                <Link
                  to="/dashboard"
                  className="mt-3 inline-block text-sm font-medium text-brand transition hover:text-brand-soft"
                >
                  Connect a bank on your dashboard
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border-default bg-surface-elevated p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium uppercase tracking-wide text-fg-muted">
                        {account.bank_name}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-fg">
                        {account.account_name}
                      </p>
                      <p className="mt-2 font-mono text-sm tabular-nums text-brand-soft">
                        {formatCurrency(getDisplayBalance(account))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(account)}
                      className="min-h-11 shrink-0 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-fg-muted transition hover:border-danger/40 hover:text-danger"
                    >
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>

          <SettingsSection title="Danger zone" variant="danger">
            <p className="text-sm leading-relaxed text-fg-muted">
              Permanently delete your Soverm account, all connected banks, transactions,
              insights, and chat history. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteAccountModal(true)}
              className="mt-4 min-h-11 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/20"
            >
              Delete my account
            </button>
          </SettingsSection>
        </div>
      </main>

      <ConfirmModal
        isOpen={!!accountToDelete}
        title="Disconnect this account?"
        message={
          accountToDelete
            ? getDisconnectConfirmMessage(accountToDelete.account_name)
            : ''
        }
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
