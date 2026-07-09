/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Soverm — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import DashboardHero from '../components/DashboardHero.jsx'
import DashboardSectionHeader from '../components/DashboardSectionHeader.jsx'
import DashboardAccountCard from '../components/DashboardAccountCard.jsx'
import FirstInsightCelebration from '../components/FirstInsightCelebration.jsx'
import DashboardNeedsAttention from '../components/DashboardNeedsAttention.jsx'
import DashboardQuickTools from '../components/quickTools/DashboardQuickTools.jsx'
import DashboardSpendingSnapshot from '../components/DashboardSpendingSnapshot.jsx'
import ActionChecklist from '../components/ActionChecklist.jsx'
import InsightGeneratingPanel from '../components/InsightGeneratingPanel.jsx'
import InsightCard from '../components/InsightCard'
import InsightFreshnessNudge from '../components/InsightFreshnessNudge.jsx'
import SecurityNote from '../components/SecurityNote'
import UsageBadge from '../components/UsageBadge.jsx'
import PaywallCard from '../components/PaywallCard.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import FirstConnectCelebration from '../components/FirstConnectCelebration.jsx'
import ConfirmModal from '../components/ConfirmModal'
import DashboardOnboarding from '../components/DashboardOnboarding.jsx'
import DashboardActionsSection from '../components/DashboardActionsSection.jsx'
import {
  DASHBOARD_TABS,
  DashboardTabBar,
  DashboardTabPanel,
} from '../components/DashboardTabs.jsx'
import DashboardHeroSkeleton from '../components/DashboardHeroSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { dashboardQueryKey, trackerQueryKey, expenseAnalyzerQueryKey, expenseAnalyzerSummaryQueryKey, notificationsQueryKey, usageQueryKey } from '../lib/queryKeys.js'
import { fetchExpenseAnalyzer, fetchExpenseAnalyzerSummary } from '../lib/fetchExpenseAnalyzer.js'
import { fetchTrackers } from '../lib/fetchTrackers.js'
import { QUICK_TOOL_TABS } from '../lib/quickTools.js'
import { fetchNotifications } from '../lib/fetchNotifications.js'
import {
  buildAttentionItems,
  countIncompleteActions,
  getInsightFreshnessNudge,
} from '../lib/dashboardAttention.js'
import {
  dismissAttentionItem,
  filterDismissedAttentionItems,
} from '../lib/dashboardAttentionDismissals.js'
import { markNotificationRead } from '../lib/fetchNotifications.js'
import { scrollToInsightChat } from '../lib/scrollToInsightChat.js'
import { syncTransactions } from '../lib/syncTransactions.js'
import { consumeFirstConnectCelebration } from '../lib/firstConnectCelebration.js'
import { disconnectAccount, getDisconnectConfirmMessage } from '../lib/disconnectAccount.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { trackUpgradeProClick } from '../lib/analytics.js'
import {
  getInitialOnboardingCollapsed,
  markDashboardVisited,
  setOnboardingCollapsedPreference,
} from '../lib/dashboardUiPrefs.js'
import {
  FloatingCfoChatButton,
  FloatingCfoChatModal,
} from '../components/FloatingCfoChat.jsx'

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
  const [onboardingCollapsed, setOnboardingCollapsed] = useState(() =>
    getInitialOnboardingCollapsed()
  )
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS.OVERVIEW)
  const [quickToolsTab, setQuickToolsTab] = useState(QUICK_TOOL_TABS.TRACKER)
  const [attentionDismissalVersion, setAttentionDismissalVersion] = useState(0)
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
        await queryClient.invalidateQueries({ queryKey: trackerQueryKey })
        await queryClient.invalidateQueries({ queryKey: expenseAnalyzerQueryKey })
        await queryClient.invalidateQueries({ queryKey: expenseAnalyzerSummaryQueryKey })
        await queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
      }
    }

    backgroundSync()
  }, [dashboardData?.lastSyncedAt, dataUpdatedAt, getToken, queryClient])

  useEffect(() => {
    markDashboardVisited()
  }, [])

  useEffect(() => {
    if (searchParams.get('chat') !== 'open') {
      return
    }

    setChatExpanded(true)
    setPendingChatScroll(true)
    setActiveTab(DASHBOARD_TABS.INSIGHT)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('chat')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('focus') !== 'balance') {
      return
    }

    setActiveTab(DASHBOARD_TABS.OVERVIEW)

    requestAnimationFrame(() => {
      document.getElementById('dashboard-hero')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('focus')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const quickTool = searchParams.get('quickTool')

    if (tab !== DASHBOARD_TABS.TOOLS && quickTool !== QUICK_TOOL_TABS.TRACKER) {
      return
    }

    if (tab === DASHBOARD_TABS.TOOLS || quickTool === QUICK_TOOL_TABS.TRACKER) {
      setActiveTab(DASHBOARD_TABS.TOOLS)
    }

    if (quickTool === QUICK_TOOL_TABS.TRACKER) {
      setQuickToolsTab(QUICK_TOOL_TABS.TRACKER)
    }

    requestAnimationFrame(() => {
      document.getElementById('dashboard-quick-tools')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('tab')
    nextParams.delete('quickTool')
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

  const { data: expenseTeaser, isPending: expenseTeaserLoading } = useQuery({
    queryKey: expenseAnalyzerSummaryQueryKey,
    queryFn: () => fetchExpenseAnalyzerSummary(getToken),
    enabled: hasAccounts,
  })

  const {
    data: trackerData,
    isPending: trackerQueryPending,
    isError: trackerIsError,
    error: trackerError,
    refetch: refetchTrackers,
  } = useQuery({
    queryKey: trackerQueryKey,
    queryFn: () => fetchTrackers(getToken),
    enabled: hasAccounts,
  })

  const trackerLoading = trackerQueryPending && trackerData === undefined

  const { data: expenseAnalyzerData, isPending: expenseAnalyzerLoading } = useQuery({
    queryKey: expenseAnalyzerQueryKey,
    queryFn: () => fetchExpenseAnalyzer(getToken),
    enabled: hasAccounts && activeTab === DASHBOARD_TABS.TOOLS,
  })

  const quickToolsLoading = expenseAnalyzerLoading && expenseAnalyzerData === undefined

  const { data: notificationsData } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchNotifications(getToken, { unreadOnly: true }),
    enabled: hasAccounts,
  })

  const incompleteActionCount = countIncompleteActions(dashboardData?.latestInsight?.actions)

  const insightFreshness = useMemo(
    () =>
      getInsightFreshnessNudge(dashboardData?.latestInsight?.created_at, {
        hasInsight,
      }),
    [dashboardData?.latestInsight?.created_at, hasInsight]
  )

  const attentionItems = useMemo(
    () =>
      buildAttentionItems({
        hasAccounts,
        hasInsight,
        highlightGenerate,
        lastSyncedAt: dashboardData?.lastSyncedAt,
        incompleteActionCount,
        unreadNotifications: notificationsData?.notifications ?? [],
        proactiveEnabled: notificationsData?.preferences?.proactiveEnabled ?? true,
        trackerSnapshot: trackerData,
      }),
    [
      hasAccounts,
      hasInsight,
      highlightGenerate,
      dashboardData?.lastSyncedAt,
      incompleteActionCount,
      notificationsData,
      trackerData,
    ]
  )

  const attentionContext = useMemo(
    () => ({
      lastSyncedAt: dashboardData?.lastSyncedAt ?? null,
      incompleteActionCount,
      trackerPeriodStart: trackerData?.periodStart ?? null,
    }),
    [dashboardData?.lastSyncedAt, incompleteActionCount, trackerData?.periodStart]
  )

  const visibleAttentionItems = useMemo(
    () => filterDismissedAttentionItems(attentionItems, attentionContext),
    [attentionItems, attentionContext, attentionDismissalVersion]
  )

  const showAttentionAllClear = hasAccounts && hasInsight && visibleAttentionItems.length === 0

  async function handleDismissAttentionItem(item) {
    dismissAttentionItem(item, attentionContext)

    if (item.notificationId) {
      try {
        await markNotificationRead(getToken, item.notificationId)
        await queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
      } catch {
        // Dismissal still applies locally
      }
    }

    setAttentionDismissalVersion((version) => version + 1)
  }

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
      setActiveTab(DASHBOARD_TABS.OVERVIEW)
      document.getElementById('dashboard-actions')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }

    prevAccountCount.current = accountCount
  }, [accountCount, hasInsight])

  function handleInsightLoadingChange(loading) {
    setInsightLoading(loading)

    if (loading) {
      setActiveTab(DASHBOARD_TABS.INSIGHT)
    }

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

  function triggerGenerateInsight() {
    setActiveTab(DASHBOARD_TABS.INSIGHT)

    function tryClick(attempt = 0) {
      const generateSection = document.getElementById('generate-insight-action-insight')
      const button = generateSection?.querySelector('button')

      if (button && !button.disabled) {
        generateSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
        button.click()
        return
      }

      if (attempt < 40) {
        window.setTimeout(() => tryClick(attempt + 1), 50)
      }
    }

    tryClick()
  }

  function handleFreshInsightGenerate() {
    triggerGenerateInsight()
  }

  function handleFirstConnectGenerate() {
    setFirstConnectCelebration(null)
    triggerGenerateInsight()
  }

  function handleNavbarChat() {
    if (!dashboardData?.latestInsight?.id) {
      showToast('Generate an insight first to ask Soverm', 'error')
      return
    }

    setChatExpanded(true)
    setActiveTab(DASHBOARD_TABS.INSIGHT)
    scrollToInsightChat()
  }

  function handleOnboardingCollapsedChange(collapsed) {
    setOnboardingCollapsed(collapsed)
    setOnboardingCollapsedPreference(collapsed)
  }

  function renderInsightSection() {
    return (
      <section>
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
              showActions={false}
            />
            {(dashboardData?.latestInsight?.actions?.length ?? 0) > 0 && (
              <ActionChecklist
                actions={dashboardData.latestInsight.actions}
                className="mt-4"
              />
            )}
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
    )
  }

  function renderAccountsSection() {
    return (
      <section className="mt-6">
        <DashboardSectionHeader title="Connected accounts" />
        {(dashboardData?.accounts ?? []).length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border-default bg-surface px-6 py-10 text-center">
            <p className="text-sm font-medium text-fg">No bank connected yet</p>
            <p className="mt-2 text-sm text-fg-muted">
              Tap <span className="text-brand-soft">Connect Your Bank</span> above to link
              your first account.
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
    )
  }

  const overviewSetupPending = !hasAccounts || highlightGenerate
  const insightAttentionPending = !hasInsight || incompleteActionCount > 0

  const showSkeleton = isPending && dashboardData === undefined
  const showFailedState = isError && dashboardData === undefined && !isPending

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar onChatClick={handleNavbarChat} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        {isError && isFetching && dashboardData && (
          <p className="mb-4 text-center text-sm text-fg-muted" role="status">
            Couldn&apos;t refresh — retrying...
          </p>
        )}

        {showSkeleton ? (
          <>
            <Skeleton className="mt-6 h-[3.25rem] w-full rounded-2xl" />
            <DashboardHeroSkeleton />
            <Skeleton className="mt-8 h-12 w-full max-w-3xl rounded-lg" />
            <section className="mt-6">
              <DashboardSectionHeader title="Connected accounts" />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
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
            <DashboardTabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              overviewSetupPending={overviewSetupPending}
              insightAttentionPending={insightAttentionPending}
            />

            <DashboardTabPanel
              tabId={DASHBOARD_TABS.OVERVIEW}
              activeTab={activeTab}
              className="mt-8 space-y-6 outline-none"
            >
              <DashboardHero
                hasAccounts={hasAccounts}
                totalBalance={dashboardData?.totalBalance ?? 0}
                lastSyncedAt={dashboardData?.lastSyncedAt}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
                income={dashboardData?.income ?? 0}
                spent={dashboardData?.spent ?? 0}
                spendingSeries={dashboardData?.spendingSeries ?? []}
                trackerSnapshot={trackerData}
              />

              <DashboardActionsSection
                showToast={showToast}
                highlightedConnect={!hasAccounts}
                showGenerateInsight={false}
              />

              {renderAccountsSection()}

              <DashboardNeedsAttention
                items={visibleAttentionItems}
                getToken={getToken}
                onSwitchTab={setActiveTab}
                onQuickToolTabChange={setQuickToolsTab}
                onDismiss={handleDismissAttentionItem}
                onAllClear={showAttentionAllClear}
              />

              {hasAccounts && (
                <DashboardSpendingSnapshot
                  summary={expenseTeaser}
                  isLoading={expenseTeaserLoading}
                />
              )}

              {!hasInsight && (
                <div className="mx-auto max-w-xl space-y-4">
                  <DashboardOnboarding
                    hasAccounts={hasAccounts}
                    hasSynced={hasSynced}
                    hasInsight={hasInsight}
                    collapsed={onboardingCollapsed}
                    onCollapsedChange={handleOnboardingCollapsedChange}
                  />
                  <SecurityNote />
                </div>
              )}
            </DashboardTabPanel>

            <DashboardTabPanel
              tabId={DASHBOARD_TABS.INSIGHT}
              activeTab={activeTab}
              className="mt-8 space-y-6 outline-none"
            >
              <div className="flex justify-center sm:justify-start">
                <UsageBadge usage={usage} />
              </div>

              <DashboardActionsSection
                showConnectBank={false}
                sectionId="dashboard-insight-actions"
                generateActionId="generate-insight-action-insight"
                showToast={showToast}
                highlightedGenerate={highlightGenerate}
                insightLoading={insightLoading}
                onInsightError={setInsightError}
                onInsightLoadingChange={handleInsightLoadingChange}
                onLimitReached={setLimitReached}
                onUsageUpdated={(updatedUsage) =>
                  queryClient.setQueryData(usageQueryKey, updatedUsage)
                }
              />

              {!hasInsight && !insightLoading && (
                <div className="rounded-xl border border-border-default bg-surface px-6 py-8 text-center">
                  <p className="text-sm font-medium text-fg">No insight yet</p>
                  <p className="mt-2 text-sm text-fg-muted">
                    Sync your accounts, then tap{' '}
                    <span className="text-brand-soft">Generate Insights</span> above to see what
                    Soverm finds.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab(DASHBOARD_TABS.OVERVIEW)}
                    className="mt-4 rounded-lg border border-border-default bg-surface-elevated px-4 py-2 text-sm font-medium text-fg transition hover:border-border-hover"
                  >
                    Go to Overview
                  </button>
                </div>
              )}

              {insightFreshness && !insightLoading && (
                <InsightFreshnessNudge
                  dayCount={insightFreshness.dayCount}
                  onGenerateClick={handleFreshInsightGenerate}
                />
              )}

              {renderInsightSection()}
            </DashboardTabPanel>

            <DashboardTabPanel
              tabId={DASHBOARD_TABS.TOOLS}
              activeTab={activeTab}
              className="mt-8 space-y-6 outline-none"
            >
              {!hasAccounts && (
                <div className="rounded-xl border border-border-default bg-surface px-6 py-8 text-center">
                  <p className="text-sm font-medium text-fg">Connect a bank to use tools</p>
                  <p className="mt-2 text-sm text-fg-muted">
                    Recent transactions, period comparisons, and account health appear here once
                    your accounts are linked.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab(DASHBOARD_TABS.OVERVIEW)}
                    className="mt-4 rounded-lg border border-border-default bg-surface-elevated px-4 py-2 text-sm font-medium text-fg transition hover:border-border-hover"
                  >
                    Go to Overview
                  </button>
                </div>
              )}

              {hasAccounts && (
                <DashboardQuickTools
                  accounts={dashboardData?.accounts ?? []}
                  lastSyncedAt={dashboardData?.lastSyncedAt}
                  expenseData={expenseAnalyzerData}
                  trackerSnapshot={trackerData}
                  trackerLoading={trackerLoading}
                  trackerError={trackerIsError ? trackerError : null}
                  onRetryTracker={() => refetchTrackers()}
                  getToken={getToken}
                  activeTab={quickToolsTab}
                  onTabChange={setQuickToolsTab}
                  isLoading={quickToolsLoading}
                />
              )}
            </DashboardTabPanel>
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
            await queryClient.invalidateQueries({ queryKey: trackerQueryKey })
            await queryClient.invalidateQueries({ queryKey: expenseAnalyzerSummaryQueryKey })
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
