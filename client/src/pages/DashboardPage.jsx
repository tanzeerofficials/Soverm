/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Soverm — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import DashboardHero from '../components/DashboardHero.jsx'
import DashboardSectionHeader from '../components/DashboardSectionHeader.jsx'
import DashboardAccountCard from '../components/DashboardAccountCard.jsx'
import FirstInsightCelebration from '../components/FirstInsightCelebration.jsx'
import ProactiveNoticeBanner from '../components/ProactiveNoticeBanner.jsx'
import ConnectBankButton from '../components/ConnectBankButton.jsx'
import SyncTransactionsButton from '../components/SyncTransactionsButton'
import GenerateInsightButton from '../components/GenerateInsightButton'
import InsightGeneratingPanel from '../components/InsightGeneratingPanel.jsx'
import InsightCard from '../components/InsightCard'
import SecurityNote from '../components/SecurityNote'
import UsageBadge from '../components/UsageBadge.jsx'
import PaywallCard from '../components/PaywallCard.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import FirstConnectCelebration from '../components/FirstConnectCelebration.jsx'
import ConfirmModal from '../components/ConfirmModal'
import DashboardOnboarding from '../components/DashboardOnboarding.jsx'
import DashboardHeroSkeleton from '../components/DashboardHeroSkeleton.jsx'
import AccountCardSkeleton from '../components/AccountCardSkeleton.jsx'
import InsightCardSkeleton from '../components/InsightCardSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { dashboardQueryKey, expenseAnalyzerSummaryQueryKey, notificationsQueryKey, usageQueryKey } from '../lib/queryKeys.js'
import { fetchExpenseAnalyzerSummary } from '../lib/fetchExpenseAnalyzer.js'
import { isNotableTopMover } from '../lib/topMover.js'
import { scrollToInsightChat } from '../lib/scrollToInsightChat.js'
import { syncTransactions } from '../lib/syncTransactions.js'
import { consumeFirstConnectCelebration } from '../lib/firstConnectCelebration.js'
import { disconnectAccount, getDisconnectConfirmMessage } from '../lib/disconnectAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { trackUpgradeProClick } from '../lib/analytics.js'
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
  const [firstConnectCelebration, setFirstConnectCelebration] = useState(null)
  const [firstInsightCelebration, setFirstInsightCelebration] = useState(false)
  const syncInFlight = useRef(false)
  const lastAutoSyncAttempt = useRef(0)
  const prevAccountCount = useRef(null)
  const celebrateFirstInsightRef = useRef(false)

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
        await queryClient.invalidateQueries({ queryKey: expenseAnalyzerSummaryQueryKey })
        await queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
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

  const { data: expenseTeaser } = useQuery({
    queryKey: expenseAnalyzerSummaryQueryKey,
    queryFn: () => fetchExpenseAnalyzerSummary(getToken),
    enabled: hasAccounts,
  })

  const notableTopMover = isNotableTopMover(expenseTeaser?.topMover)
    ? expenseTeaser.topMover
    : null

  const showExpenseTeaser =
    (expenseTeaser?.recurringCount ?? 0) > 0 || notableTopMover != null

  useEffect(() => {
    if (accountCount === 0 || hasInsight) {
      prevAccountCount.current = accountCount
      return
    }

    const wasFirstAccountLink =
      prevAccountCount.current !== null &&
      prevAccountCount.current === 0 &&
      accountCount > 0

    const celebrationMeta = consumeFirstConnectCelebration()

    if (celebrationMeta) {
      setFirstConnectCelebration(celebrationMeta)
    } else if (wasFirstAccountLink) {
      document.getElementById('generate-insight-action')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }

    prevAccountCount.current = accountCount
  }, [accountCount, hasInsight])

  function handleInsightLoadingChange(loading) {
    setInsightLoading(loading)

    if (loading && !hasInsight) {
      celebrateFirstInsightRef.current = true
    }
  }

  useEffect(() => {
    if (!insightLoading && hasInsight && celebrateFirstInsightRef.current) {
      celebrateFirstInsightRef.current = false
      setFirstInsightCelebration(true)
    }
  }, [insightLoading, hasInsight])

  function handleFirstConnectClose() {
    setFirstConnectCelebration(null)
  }

  function handleFirstConnectGenerate() {
    setFirstConnectCelebration(null)
    document.getElementById('generate-insight-action')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    window.setTimeout(() => {
      document.querySelector('#generate-insight-action button')?.click()
    }, 450)
  }

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
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar onChatClick={handleNavbarChat} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <ProactiveNoticeBanner />

        {isError && isFetching && dashboardData && (
          <p className="mb-4 text-center text-sm text-fg-muted" role="status">
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
              <DashboardSectionHeader title="Your Accounts" />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <AccountCardSkeleton key={index} />
                ))}
              </div>
            </section>

            <section className="mt-12">
              <DashboardSectionHeader title="Soverm Insight" accent="ai" />
              <InsightCardSkeleton />
            </section>
          </>
        ) : showFailedState ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-danger" role="alert">
              Couldn&apos;t load your dashboard. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-brand-soft"
            >
              Try again
            </button>
          </div>
        ) : dashboardData ? (
          <>
            {/* Hero */}
            <DashboardHero
              hasAccounts={hasAccounts}
              totalBalance={dashboardData?.totalBalance ?? 0}
              lastSyncedAt={dashboardData?.lastSyncedAt}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              income={dashboardData?.income ?? 0}
              spent={dashboardData?.spent ?? 0}
              spendingSeries={dashboardData?.spendingSeries ?? []}
            />

            {hasAccounts && showExpenseTeaser && (
              <div className="mt-4 text-center">
                <p className="text-xs text-fg-muted">
                  {[
                    notableTopMover
                      ? `${notableTopMover.category} ${notableTopMover.direction} ${notableTopMover.percent}% vs prior 30 days`
                      : null,
                    (expenseTeaser?.recurringCount ?? 0) > 0
                      ? `${expenseTeaser.recurringCount} subscription${expenseTeaser.recurringCount === 1 ? '' : 's'} detected · ${formatCurrency(expenseTeaser.totalRecurringMonthly)}/mo`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {' · '}
                  <Link
                    to="/expense-analyzer"
                    className="text-ai-soft transition hover:text-ai hover:underline"
                  >
                    View Expense Analyzer →
                  </Link>
                </p>
                {(expenseTeaser?.recurringPreview?.length ?? 0) > 0 && (
                  <ul className="mx-auto mt-2 max-w-md space-y-1 text-xs text-fg-subtle">
                    {expenseTeaser.recurringPreview.map((item) => (
                      <li key={`${item.merchant}-${item.accountLabel ?? 'unknown'}`}>
                        {item.merchant}
                        {item.accountLabel ? ` · ${item.accountLabel}` : ''}
                        {' · '}
                        {formatCurrency(item.monthlyEquivalent)}/mo
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
                  onLoadingChange={handleInsightLoadingChange}
                  onLimitReached={setLimitReached}
                  onUsageUpdated={(updatedUsage) =>
                    queryClient.setQueryData(usageQueryKey, updatedUsage)
                  }
                />
              </div>
            </section>

            {/* Accounts */}
            <section className="mt-12">
              <DashboardSectionHeader title="Your Accounts" />
              {(dashboardData?.accounts ?? []).length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border-default bg-surface px-6 py-10 text-center">
                  <p className="text-sm font-medium text-fg">
                    No bank connected yet
                  </p>
                  <p className="mt-2 text-sm text-fg-muted">
                    Tap <span className="text-brand-soft">Connect Your Bank</span> above —
                    that&apos;s your first step.
                  </p>
                </div>
              ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(dashboardData?.accounts ?? []).map((account) => (
                  <DashboardAccountCard
                    key={account.id}
                    account={account}
                    onDisconnect={setAccountToDelete}
                  />
                ))}
              </div>
              )}
            </section>

            {/* AI Insight */}
            <section className="mt-12">
              <DashboardSectionHeader title="Soverm Insight" accent="ai" />

              {insightError && (
                <p className="mb-4 text-sm text-danger" role="alert">
                  {insightError}
                </p>
              )}

              {insightLoading ? (
                <InsightGeneratingPanel />
              ) : (
                <>
                  <FirstInsightCelebration
                    isOpen={firstInsightCelebration}
                    onDismiss={() => setFirstInsightCelebration(false)}
                  />
                  <InsightCard
                    insight={dashboardData?.latestInsight}
                    onChatError={(message) => showToast(message, 'error')}
                    chatExpanded={chatExpanded}
                    onChatExpandedChange={setChatExpanded}
                  />
                  {showPaywall && (
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-fg-subtle">
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
      <FirstConnectCelebration
        isOpen={Boolean(firstConnectCelebration)}
        accountsConnected={firstConnectCelebration?.accountsConnected ?? 1}
        syncedAdded={firstConnectCelebration?.syncedAdded ?? 0}
        onClose={handleFirstConnectClose}
        onGenerateInsight={handleFirstConnectGenerate}
      />
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
