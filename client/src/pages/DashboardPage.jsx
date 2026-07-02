/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Soverm — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import ConnectBankButton from '../components/ConnectBankButton.jsx'
import SyncTransactionsButton from '../components/SyncTransactionsButton'
import GenerateInsightButton from '../components/GenerateInsightButton'
import InsightCard from '../components/InsightCard'
import SecurityNote from '../components/SecurityNote'
import UsageBadge from '../components/UsageBadge.jsx'
import PaywallCard from '../components/PaywallCard.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import ConfirmModal from '../components/ConfirmModal'
import DashboardOnboarding from '../components/DashboardOnboarding.jsx'
import DashboardHeroSkeleton from '../components/DashboardHeroSkeleton.jsx'
import AccountCardSkeleton from '../components/AccountCardSkeleton.jsx'
import InsightCardSkeleton from '../components/InsightCardSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { dashboardQueryKey, usageQueryKey } from '../lib/queryKeys.js'
import { scrollToInsightChat } from '../lib/scrollToInsightChat.js'
import { syncTransactions } from '../lib/syncTransactions.js'
import { disconnectAccount } from '../lib/disconnectAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { trackUpgradeProClick } from '../lib/analytics.js'
import { getDisplayBalance, isCreditAccount } from '../lib/balanceHelpers.js'
import {
  FloatingCfoChatButton,
  FloatingCfoChatModal,
} from '../components/FloatingCfoChat.jsx'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function isBalanceWarning(account) {
  const balance = getDisplayBalance(account)
  if (isCreditAccount(account)) {
    return balance > 0
  }
  return balance < 0
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
]

const RANGE_LABELS = {
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  '3m': 'in the last 3 months',
  '1y': 'in the last year',
}

const AUTO_SYNC_STALE_MINUTES = 5
const AUTO_SYNC_RETRY_MS = AUTO_SYNC_STALE_MINUTES * 60 * 1000

function minutesSinceSync(lastSyncedAt) {
  if (!lastSyncedAt) {
    return Infinity
  }
  return (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60)
}

function DashboardPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [insightError, setInsightError] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)
  const [floatingChatOpen, setFloatingChatOpen] = useState(false)
  const [pendingChatScroll, setPendingChatScroll] = useState(false)
  const [selectedRange, setSelectedRange] = useState('30d')
  const { showToast } = useToastContext()
  const [accountToDelete, setAccountToDelete] = useState(null)
  const syncInFlight = useRef(false)
  const lastAutoSyncAttempt = useRef(0)
  const prevAccountCount = useRef(null)

  const { data: usage } = useQuery({
    queryKey: usageQueryKey,
    queryFn: () => fetchUsage(getToken),
  })

  const showPaywall =
    limitReached || (!usage?.isPro && usage?.remainingToday === 0)

  const {
    data: dashboardData,
    isPending,
    isFetching,
    isError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard', selectedRange],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/dashboard/summary?range=${selectedRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        throw new Error(`Dashboard fetch failed: ${res.status}`)
      }
      return res.json()
    },
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!dashboardData || syncInFlight.current) {
      return
    }

    if (minutesSinceSync(dashboardData.lastSyncedAt) <= AUTO_SYNC_STALE_MINUTES) {
      return
    }

    const now = Date.now()
    if (now - lastAutoSyncAttempt.current < AUTO_SYNC_RETRY_MS) {
      return
    }

    lastAutoSyncAttempt.current = now
    syncInFlight.current = true

    async function backgroundSync() {
      try {
        await syncTransactions(getToken)
      } catch (err) {
        console.error('Background sync failed:', err.message)
      } finally {
        syncInFlight.current = false
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    }

    backgroundSync()
  }, [dashboardData?.lastSyncedAt, dataUpdatedAt, getToken, queryClient])

  useEffect(() => {
    if (searchParams.get('chat') !== 'open') {
      return
    }

    setChatExpanded(true)
    setPendingChatScroll(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('chat')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!pendingChatScroll || !dashboardData?.latestInsight?.id) {
      return
    }

    scrollToInsightChat()
    setPendingChatScroll(false)
  }, [pendingChatScroll, dashboardData?.latestInsight?.id])

  const accountCount = dashboardData?.accounts?.length ?? 0
  const hasAccounts = accountCount > 0
  const hasSynced = !!dashboardData?.lastSyncedAt
  const hasInsight = !!dashboardData?.latestInsight
  const highlightGenerate = hasAccounts && hasSynced && !hasInsight

  useEffect(() => {
    if (prevAccountCount.current === null) {
      prevAccountCount.current = accountCount
      return
    }

    if (prevAccountCount.current === 0 && accountCount > 0 && !hasInsight) {
      document.getElementById('generate-insight-action')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }

    prevAccountCount.current = accountCount
  }, [accountCount, hasInsight])

  function handleNavbarChat() {
    if (!dashboardData?.latestInsight?.id) {
      showToast('Generate an insight first to ask Soverm', 'error')
      return
    }

    setChatExpanded(true)
    scrollToInsightChat()
  }

  const showSkeleton = isPending && dashboardData === undefined
  const showFailedState = isError && dashboardData === undefined && !isPending

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <AppNavbar
        onChatClick={handleNavbarChat}
        leftContent={
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]">
            Soverm
          </span>
        }
      >
        <Link
          to="/history"
          className="shrink-0 text-sm text-[#9CA3AF] transition hover:text-white"
        >
          View History
        </Link>
      </AppNavbar>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        {isError && isFetching && dashboardData && (
          <p className="mb-4 text-center text-sm text-[#9CA3AF]" role="status">
            Couldn&apos;t refresh — retrying...
          </p>
        )}

        {showSkeleton ? (
          <>
            <DashboardHeroSkeleton />

            <section className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Skeleton className="h-12 w-full max-w-[200px] rounded-lg sm:flex-1" />
              <Skeleton className="h-12 w-full max-w-[200px] rounded-lg sm:flex-1" />
              <Skeleton className="h-12 w-full max-w-[200px] rounded-lg sm:flex-1" />
            </section>

            <section className="mt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                Your Accounts
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <AccountCardSkeleton key={index} />
                ))}
              </div>
            </section>

            <section className="mt-12">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                  Soverm Insight
                </h2>
                <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" aria-hidden="true" />
              </div>
              <InsightCardSkeleton />
            </section>
          </>
        ) : showFailedState ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-[#EF4444]" role="alert">
              Couldn&apos;t load your dashboard. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              Try again
            </button>
          </div>
        ) : dashboardData ? (
          <>
            {/* Hero */}
            <section className="text-center">
              {!hasAccounts ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#10B981]">
                    Step 1
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-[#F9FAFB] sm:text-3xl">
                    Connect your bank to get started
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#9CA3AF]">
                    Soverm needs your accounts linked before it can analyze your finances.
                    Your bank login stays with Plaid — we never see it.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#9CA3AF]">
                    Total Balance
                  </p>
                  <p className="mt-3 font-mono text-4xl font-light tracking-tight text-[#F9FAFB] sm:text-6xl md:text-7xl">
                    {formatCurrency(dashboardData?.totalBalance ?? 0)}
                  </p>
                  {dashboardData?.lastSyncedAt && (
                    <>
                      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
                        <span className="text-emerald-500" aria-hidden="true">
                          ●
                        </span>
                        Last synced{' '}
                        {formatDistanceToNow(new Date(dashboardData.lastSyncedAt))} ago
                      </p>
                      <p className="mt-1 text-center text-xs text-[#6B7280]">
                        Recent transactions may take a few minutes to appear
                      </p>
                    </>
                  )}
                  <div className="mt-5 mb-2 flex justify-center gap-2">
                    {RANGE_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSelectedRange(value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          selectedRange === value
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-[#1A2236] text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                    <span className="text-sm text-[#10B981]">
                      ↑ {formatCurrency(dashboardData?.income ?? 0)} income{' '}
                      {RANGE_LABELS[selectedRange]}
                    </span>
                    <span className="text-sm text-[#EF4444]">
                      ↓ {formatCurrency(dashboardData?.spent ?? 0)} spent{' '}
                      {RANGE_LABELS[selectedRange]}
                    </span>
                  </div>
                </>
              )}
            </section>

            <div className="mx-auto mt-8 max-w-xl space-y-4">
              <DashboardOnboarding
                hasAccounts={hasAccounts}
                hasSynced={hasSynced}
                hasInsight={hasInsight}
              />
              <SecurityNote />
            </div>

            <div className="mt-6 flex justify-center">
              <UsageBadge usage={usage} />
            </div>

            {/* Action row */}
            <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center">
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <ConnectBankButton
                  className="w-full"
                  highlighted={!hasAccounts}
                  showSecurityNote={false}
                />
              </div>
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <SyncTransactionsButton className="w-full" showToast={showToast} />
              </div>
              <div id="generate-insight-action" className="w-full sm:max-w-[200px] sm:flex-1">
                <GenerateInsightButton
                  className="w-full"
                  showCard={false}
                  showToast={showToast}
                  highlighted={highlightGenerate}
                  onError={setInsightError}
                  onLoadingChange={setInsightLoading}
                  onLimitReached={setLimitReached}
                  onUsageUpdated={(updatedUsage) =>
                    queryClient.setQueryData(usageQueryKey, updatedUsage)
                  }
                />
              </div>
            </section>

            {/* Accounts */}
            <section className="mt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                Your Accounts
              </h2>
              {(dashboardData?.accounts ?? []).length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
                  <p className="text-sm font-medium text-[#F9FAFB]">
                    No bank connected yet
                  </p>
                  <p className="mt-2 text-sm text-[#9CA3AF]">
                    Tap <span className="text-[#10B981]">Connect Your Bank</span> above —
                    that&apos;s your first step.
                  </p>
                </div>
              ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(dashboardData?.accounts ?? []).map((account) => {
                  const balanceIsWarning = isBalanceWarning(account)
                  return (
                    <article
                      key={account.id}
                      className="relative min-w-0 rounded-xl border border-[#1E2D45] bg-[#111827] p-4 sm:p-5 transition hover:border-[#10B981]/40 hover:bg-[#1A2236]"
                    >
                      <button
                        type="button"
                        onClick={() => setAccountToDelete(account)}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-sm text-[#9CA3AF] transition hover:text-red-400"
                        aria-label={`Disconnect ${account.account_name}`}
                      >
                        ×
                      </button>
                      <p className="truncate pr-8 text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                        {account.bank_name}
                      </p>
                      <p className="mt-1 truncate pr-8 text-sm font-medium text-[#F9FAFB]">
                        {account.account_name}
                      </p>
                      <span className="mt-2 inline-block max-w-full truncate rounded-full border border-[#1E2D45] bg-[#1A2236] px-2.5 py-0.5 text-xs capitalize text-[#9CA3AF]">
                        {account.account_type}
                      </span>
                      <p
                        className={`mt-4 break-all font-mono text-xl font-semibold sm:text-2xl ${
                          balanceIsWarning ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        {formatCurrency(getDisplayBalance(account))}
                      </p>
                    </article>
                  )
                })}
              </div>
              )}
            </section>

            {/* AI Insight */}
            <section className="mt-12">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                  Soverm Insight
                </h2>
                <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" aria-hidden="true" />
              </div>

              {insightError && (
                <p className="mb-4 text-sm text-[#EF4444]" role="alert">
                  {insightError}
                </p>
              )}

              {insightLoading ? (
                <InsightCardSkeleton />
              ) : (
                <>
                  <InsightCard
                    insight={dashboardData?.latestInsight}
                    onChatError={(message) => showToast(message, 'error')}
                    chatExpanded={chatExpanded}
                    onChatExpandedChange={setChatExpanded}
                  />
                  {showPaywall && (
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
                        Want another insight today?
                      </p>
                      <PaywallCard
                        spent={dashboardData?.spent}
                        onUpgrade={() => {
                          trackUpgradeProClick('dashboard_paywall')
                          showToast(
                            'Soverm Pro checkout is coming soon — stay tuned!',
                            'success'
                          )
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : null}
      </main>
      <ConfirmModal
        isOpen={!!accountToDelete}
        title="Disconnect this account?"
        message={`This will stop syncing "${accountToDelete?.account_name}". Your transaction history will be kept.`}
        confirmLabel="Disconnect"
        onCancel={() => setAccountToDelete(null)}
        onConfirm={async () => {
          if (!accountToDelete) return

          const accountName = accountToDelete.account_name

          try {
            await disconnectAccount(getToken, accountToDelete.id)
            setAccountToDelete(null)
            showToast(`"${accountName}" disconnected`, 'success')
            await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
          } catch (err) {
            console.error('Failed to disconnect account:', err.message)
            showToast('Failed to disconnect account — please try again', 'error')
          }
        }}
      />

      {!showFailedState && (
        <>
          {!floatingChatOpen && (
            <FloatingCfoChatButton onClick={() => setFloatingChatOpen(true)} />
          )}
          <FloatingCfoChatModal
            isOpen={floatingChatOpen}
            onClose={() => setFloatingChatOpen(false)}
            insightId={dashboardData?.latestInsight?.id}
            onChatError={(message) => showToast(message, 'error')}
          />
        </>
      )}
    </div>
  )
}

export default DashboardPage
