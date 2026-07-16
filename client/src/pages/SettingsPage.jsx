/*
 * SETTINGS PAGE
 *
 * Account management: connected banks, plan/usage, and permanent deletion.
 */

import { useEffect, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SettingsSection from '../components/SettingsSection.jsx'
import PaydaySettingsSection from '../components/PaydaySettingsSection.jsx'
import ConnectBankButton from '../components/ConnectBankButton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import UsageBadge from '../components/UsageBadge.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import { disconnectAccount, getDisconnectConfirmMessage } from '../lib/disconnectAccount.js'
import { deleteAccount } from '../lib/deleteAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { fetchBillingStatus, waitForProUnlock } from '../lib/fetchBillingStatus.js'
import { fetchNotifications, updateNotificationPreferences } from '../lib/fetchNotifications.js'
import {
  billingStatusQueryKey,
  dashboardSummaryQueryKey,
  invalidateAfterAccountChange,
  notificationsAllQueryKey,
  notificationsQueryKey,
  usageQueryKey,
} from '../lib/queryKeys.js'
import { getDisplayBalance } from '../lib/balanceHelpers.js'
import { trackUpgradeProClick } from '../lib/analytics.js'
import {
  checkoutErrorToastMessage,
  openBillingPortal,
  portalErrorToastMessage,
  reactivateErrorToastMessage,
  reactivateProSubscription,
  startProCheckout,
} from '../lib/startProCheckout.js'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()

  const [accountToDelete, setAccountToDelete] = useState(null)
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [reactivateLoading, setReactivateLoading] = useState(false)

  /*
   * Stripe redirects leave this page; browser Back can restore a cached copy
   * with checkoutLoading/portalLoading still true ("Opening…" stuck). Reset
   * whenever the page is shown again from bfcache.
   */
  useEffect(() => {
    function resetBillingButtonState() {
      setCheckoutLoading(false)
      setPortalLoading(false)
      setReactivateLoading(false)
    }

    function onPageShow(event) {
      if (event.persisted) {
        resetBillingButtonState()
      }
    }

    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  /*
   * What this does: reads ?billing=success|canceled after Stripe Checkout redirect.
   * Why: Stripe sends users back here; we toast and clear the query so refresh
   * does not repeat the message. Pro status still comes from the Stripe webhook —
   * we poll briefly so the UI can confirm unlock when the webhook lands.
   */
  useEffect(() => {
    const billing = searchParams.get('billing')
    if (!billing) {
      return
    }

    let cancelled = false

    async function handleBillingReturn() {
      if (billing === 'success') {
        showToast('Payment received — confirming Pro…', 'success')
        queryClient.invalidateQueries({ queryKey: usageQueryKey })
        queryClient.invalidateQueries({ queryKey: billingStatusQueryKey })

        const { unlocked } = await waitForProUnlock(getToken)
        if (cancelled) {
          return
        }

        await queryClient.invalidateQueries({ queryKey: usageQueryKey })
        await queryClient.invalidateQueries({ queryKey: billingStatusQueryKey })

        if (unlocked) {
          showToast('You’re on Soverm Pro — unlimited insights unlocked', 'success')
        } else {
          showToast(
            'Payment received — Pro unlocks once Stripe confirms (usually seconds)',
            'success'
          )
        }
      } else if (billing === 'canceled') {
        showToast('Checkout canceled — you can upgrade anytime', 'success')
      }

      if (cancelled) {
        return
      }

      const next = new URLSearchParams(searchParams)
      next.delete('billing')
      setSearchParams(next, { replace: true })
    }

    handleBillingReturn()

    return () => {
      cancelled = true
    }
  }, [searchParams, setSearchParams, showToast, queryClient, getToken])

  const { data: usage } = useQuery({
    queryKey: usageQueryKey,
    queryFn: () => fetchUsage(getToken),
  })

  const { data: billingStatus } = useQuery({
    queryKey: billingStatusQueryKey,
    queryFn: () => fetchBillingStatus(getToken),
    // Refresh after returning from Stripe portal so cancel-at-period-end shows promptly.
    refetchOnWindowFocus: true,
  })

  const billingConfigured = billingStatus?.configured !== false
  const isPro = usage?.isPro ?? billingStatus?.isPro ?? false
  const cancelAtPeriodEnd = Boolean(billingStatus?.cancelAtPeriodEnd)
  const billingPeriodEndsAt =
    billingStatus?.currentPeriodEnd || billingStatus?.proAccessEndsAt || null
  const billingPeriodEndsLabel = billingPeriodEndsAt
    ? new Date(billingPeriodEndsAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const { data: notificationData } = useQuery({
    queryKey: notificationsAllQueryKey,
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
    queryKey: dashboardSummaryQueryKey('30d'),
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/summary?range=30d`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Dashboard fetch failed: ${res.status}`)
      }
      return res.json()
    },
  })

  const accounts = dashboardData?.accounts ?? []

  /*
   * What this does: opens Stripe Checkout for monthly Pro.
   * Why: Settings "Your plan" is the natural place to upgrade after hitting
   * free-tier limits; success/cancel return to /settings?billing=...
   */
  async function handleUpgrade() {
    if (!billingConfigured) {
      showToast('Soverm Pro checkout is not available yet — please try again later', 'error')
      return
    }

    trackUpgradeProClick('settings')
    setCheckoutLoading(true)
    try {
      await startProCheckout(getToken)
    } catch (err) {
      showToast(checkoutErrorToastMessage(err), 'error')
    } finally {
      // Redirect usually unloads the page; clear if we stay put (Back / failed nav).
      window.setTimeout(() => setCheckoutLoading(false), 2500)
    }
  }

  /*
   * What this does: opens Stripe Customer Portal for Pro users.
   * Why: update card / cancel must happen in Stripe's hosted portal —
   * Checkout only covers the initial upgrade.
   */
  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      await openBillingPortal(getToken)
    } catch (err) {
      showToast(portalErrorToastMessage(err), 'error')
    } finally {
      window.setTimeout(() => setPortalLoading(false), 2500)
    }
  }

  /*
   * What this does: undoes a scheduled cancel so Pro keeps renewing.
   * Why: users who cancel in Stripe need an obvious Keep Pro button on Profile.
   */
  async function handleKeepPro() {
    setReactivateLoading(true)
    try {
      await reactivateProSubscription(getToken)
      await queryClient.invalidateQueries({ queryKey: billingStatusQueryKey })
      await queryClient.invalidateQueries({ queryKey: usageQueryKey })
      showToast('Soverm Pro will keep renewing — cancellation removed', 'success')
    } catch (err) {
      showToast(reactivateErrorToastMessage(err), 'error')
    } finally {
      setReactivateLoading(false)
    }
  }

  async function handleDisconnectConfirm() {
    if (!accountToDelete) return

    const accountId = accountToDelete.id
    const accountName = accountToDelete.account_name

    try {
      await disconnectAccount(getToken, accountId)
      setAccountToDelete(null)
      showToast(`"${accountName}" disconnected`, 'success')
      await invalidateAfterAccountChange(queryClient)
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
      queryClient.clear()
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
      <AppNavbar backTo="/dashboard" backLabel="Home" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader
          title="Profile"
          description="Manage your plan, payday, connected banks, notifications, and account data."
        />

        <div className="space-y-8">
          <SettingsSection title="Your plan">
            <div className="flex flex-col gap-3">
              <p className="text-lg font-semibold text-fg">
                {isPro ? 'Soverm Pro' : 'Free'}
              </p>
              <UsageBadge usage={usage} />
              {isPro ? (
                <>
                  {cancelAtPeriodEnd ? (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-3">
                      <p className="text-sm font-semibold text-fg">Cancellation scheduled</p>
                      <p className="mt-1 text-sm text-fg-muted">
                        You won&apos;t be charged again.
                        {billingPeriodEndsLabel ? (
                          <>
                            {' '}
                            Soverm Pro stays available until{' '}
                            <span className="font-medium text-fg">{billingPeriodEndsLabel}</span>
                            . After that date you move back to Free.
                          </>
                        ) : (
                          <> Soverm Pro stays available through the end of this billing period.</>
                        )}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleKeepPro}
                          disabled={reactivateLoading || !billingConfigured}
                          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto"
                        >
                          {reactivateLoading ? 'Renewing…' : 'Keep Pro / Resubscribe'}
                        </button>
                        <button
                          type="button"
                          onClick={handleManageBilling}
                          disabled={portalLoading || !billingConfigured}
                          className="w-full rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-elevated disabled:opacity-60 sm:w-auto"
                        >
                          {portalLoading ? 'Opening…' : 'Manage billing'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 text-xs leading-relaxed text-fg-subtle">
                        {billingPeriodEndsLabel ? (
                          <p>
                            Current billing period ends{' '}
                            <span className="font-medium text-fg-muted">
                              {billingPeriodEndsLabel}
                            </span>
                            . Renews automatically unless you cancel.
                          </p>
                        ) : null}
                        <p>
                          Update your payment method or cancel anytime in the Stripe billing
                          portal.
                          {billingPeriodEndsLabel
                            ? ` If you cancel, Pro stays active through ${billingPeriodEndsLabel}.`
                            : ' If you cancel, Pro stays active through the end of the billing period.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleManageBilling}
                        disabled={portalLoading || !billingConfigured}
                        className="mt-1 w-full rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-elevated disabled:opacity-60 sm:w-auto"
                      >
                        {portalLoading ? 'Opening…' : 'Manage billing'}
                      </button>
                    </>
                  )}
                  {!billingConfigured && (
                    <p className="text-xs text-fg-subtle">
                      Billing management is unavailable right now.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-fg-subtle">
                    {usage?.generatedToday ?? 0} insight
                    {(usage?.generatedToday ?? 0) === 1 ? '' : 's'} generated today
                    {billingStatus?.hasStripeCustomer
                      ? ' · You can resubscribe to Pro anytime.'
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={checkoutLoading || !billingConfigured}
                    className="mt-1 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60 sm:w-auto"
                  >
                    {checkoutLoading
                      ? 'Redirecting…'
                      : !billingConfigured
                        ? 'Checkout unavailable'
                        : billingStatus?.hasStripeCustomer
                          ? 'Resubscribe to Soverm Pro'
                          : 'Upgrade to Soverm Pro'}
                  </button>
                </>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Proactive alerts</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                  Soverm sends your weekly check-in and month letter when ready, plus unusual
                  charges, low balance, new subscriptions, and spending-cap alerts after each sync.
                  Alerts appear in the bell icon and on your dashboard.
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

          <SettingsSection title="Payday (for what’s left)">
            <PaydaySettingsSection />
          </SettingsSection>

          <SettingsSection title="Connected banks">
            {accountsLoading ? (
              <SettingsAccountSkeleton />
            ) : accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-default px-4 py-8 text-center">
                <p className="text-sm text-fg-muted">No banks connected yet.</p>
                <div className="mx-auto mt-4 max-w-xs">
                  <ConnectBankButton showSecurityNote={false} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                <div className="max-w-xs">
                  <ConnectBankButton
                    label="Add another bank"
                    variant="secondary"
                    showSecurityNote={false}
                  />
                </div>
              </div>
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
