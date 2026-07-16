/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Soverm — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import DashboardHero from '../components/DashboardHero.jsx'
import DashboardConnectedAccounts from '../components/DashboardConnectedAccounts.jsx'
import DashboardSectionHeader from '../components/DashboardSectionHeader.jsx'
import FirstInsightCelebration from '../components/FirstInsightCelebration.jsx'
import DashboardNeedsAttention from '../components/DashboardNeedsAttention.jsx'
import DashboardQuickTools from '../components/quickTools/DashboardQuickTools.jsx'
import DashboardSpendingSnapshot from '../components/DashboardSpendingSnapshot.jsx'
import DashboardUpcomingBills from '../components/DashboardUpcomingBills.jsx'
import ActionChecklist from '../components/ActionChecklist.jsx'
import InsightGeneratingPanel from '../components/InsightGeneratingPanel.jsx'
import InsightCard from '../components/InsightCard'
import InsightFreshnessNudge from '../components/InsightFreshnessNudge.jsx'
import SecurityNote from '../components/SecurityNote'
import UsageBadge from '../components/UsageBadge.jsx'
import PaywallCard from '../components/PaywallCard.jsx'
import FreeVsProPlanCallout from '../components/FreeVsProPlanCallout.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import FirstConnectCelebration from '../components/FirstConnectCelebration.jsx'
import ActivationChecklist from '../components/ActivationChecklist.jsx'
import DashboardActionsSection from '../components/DashboardActionsSection.jsx'
import ConnectBankButton from '../components/ConnectBankButton.jsx'
import {
  DASHBOARD_TABS,
  DashboardTabBar,
  DashboardTabPanel,
} from '../components/DashboardTabs.jsx'
import DashboardHeroSkeleton from '../components/DashboardHeroSkeleton.jsx'
import Skeleton from '../components/Skeleton.jsx'
import {
  dashboardSummaryQueryKey,
  trackerQueryKey,
  paydayQueryKey,
  cashFlowForecastQueryKey,
  expenseAnalyzerQueryKey,
  expenseAnalyzerSummaryQueryKey,
  invalidateAfterAccountChange,
  notificationsQueryKey,
  notificationsUnreadQueryKey,
  usageQueryKey,
} from '../lib/queryKeys.js'
import { fetchExpenseAnalyzer, fetchExpenseAnalyzerSummary } from '../lib/fetchExpenseAnalyzer.js'
import { fetchTrackers } from '../lib/fetchTrackers.js'
import { fetchCashFlowForecast } from '../lib/fetchCashFlowForecast.js'
import { QUICK_TOOL_TABS } from '../lib/quickTools.js'
import { fetchNotifications } from '../lib/fetchNotifications.js'
import {
  buildAttentionItems,
  countIncompleteActions,
  getInsightFreshnessNudge,
  hoursSinceSync,
  SYNC_STALE_HOURS,
} from '../lib/dashboardAttention.js'
import {
  dismissAttentionItem,
  filterDismissedAttentionItems,
} from '../lib/dashboardAttentionDismissals.js'
import { markNotificationRead } from '../lib/fetchNotifications.js'
import { syncTransactions } from '../lib/syncTransactions.js'
import { consumeFirstConnectCelebration } from '../lib/firstConnectCelebration.js'
import { fetchUsage } from '../lib/fetchUsage.js'
import { trackUpgradeProClick } from '../lib/analytics.js'
import {
  checkoutErrorToastMessage,
  startProCheckout,
} from '../lib/startProCheckout.js'
import {
  buildHomeGreeting,
  hasVisitedDashboard,
  markDashboardVisited,
} from '../lib/dashboardUiPrefs.js'
import { useAskSoverm } from '../context/AskSovermContext.jsx'
import { buildActivationChecklist } from '../lib/activationChecklist.js'

const AUTO_SYNC_STALE_MINUTES = 5
const AUTO_SYNC_RETRY_MS = AUTO_SYNC_STALE_MINUTES * 60 * 1000

function minutesSinceSync(lastSyncedAt) {
  if (!lastSyncedAt) {
    return Infinity
  }
  return (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60)
}

function DashboardPage() {
  const { getToken, userId } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { openChat } = useAskSoverm()

  const [insightError, setInsightError] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [selectedRange, setSelectedRange] = useState('30d')
  const { showToast } = useToastContext()
  const [firstConnectCelebration, setFirstConnectCelebration] = useState(null)
  const [firstInsightCelebration, setFirstInsightCelebration] = useState(false)
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS.OVERVIEW)
  const [quickToolsTab, setQuickToolsTab] = useState(QUICK_TOOL_TABS.TRACKER)
  const [attentionDismissalVersion, setAttentionDismissalVersion] = useState(0)
  const syncInFlight = useRef(false)
  const lastAutoSyncAttempt = useRef(0)
  const prevAccountCount = useRef(null)
  const celebrateFirstInsightRef = useRef(false)
  /*
   * Snapshot “have they opened Home before?” once — markDashboardVisited runs
   * later, so this stays accurate for Hi vs Welcome back in this session.
   */
  const hasVisitedHomeBefore = useRef(hasVisitedDashboard(userId))
  const homeGreeting = useMemo(
    () =>
      buildHomeGreeting(user?.firstName, {
        hasVisitedBefore: hasVisitedHomeBefore.current,
      }),
    [user?.firstName]
  )

  const { data: usage } = useQuery({
    queryKey: usageQueryKey,
    queryFn: () => fetchUsage(getToken),
  })

  const showPaywall =
    limitReached || (!usage?.isPro && usage?.remainingToday === 0)

  const isPro = usage?.isPro ?? false

  async function handleUpgrade(source) {
    trackUpgradeProClick(source)
    try {
      await startProCheckout(getToken)
    } catch (err) {
      showToast(checkoutErrorToastMessage(err), 'error')
    }
  }

  const {
    data: dashboardData,
    isPending,
    isFetching,
    isError,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: dashboardSummaryQueryKey(selectedRange),
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

    if ((dashboardData.accounts?.length ?? 0) === 0) {
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
        await invalidateAfterAccountChange(queryClient)
      }
    }

    backgroundSync()
  }, [dashboardData?.lastSyncedAt, dataUpdatedAt, getToken, queryClient])

  useEffect(() => {
    if (!userId) {
      return
    }
    markDashboardVisited(userId)
  }, [userId])

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

    const knownQuickTools = [
      QUICK_TOOL_TABS.TRACKER,
      QUICK_TOOL_TABS.FORECAST,
      QUICK_TOOL_TABS.SPEND,
    ]

    if (tab !== DASHBOARD_TABS.TOOLS && !knownQuickTools.includes(quickTool)) {
      return
    }

    if (tab === DASHBOARD_TABS.TOOLS || knownQuickTools.includes(quickTool)) {
      setActiveTab(DASHBOARD_TABS.TOOLS)
    }

    if (quickTool === QUICK_TOOL_TABS.TRACKER) {
      setQuickToolsTab(QUICK_TOOL_TABS.TRACKER)
    }

    if (quickTool === QUICK_TOOL_TABS.FORECAST) {
      setQuickToolsTab(QUICK_TOOL_TABS.FORECAST)
    }

    if (quickTool === QUICK_TOOL_TABS.SPEND) {
      setQuickToolsTab(QUICK_TOOL_TABS.SPEND)
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

  const accountCount = dashboardData?.accounts?.length ?? 0
  const hasAccounts = accountCount > 0
  const hasSynced = !!dashboardData?.lastSyncedAt
  const hasInsight = !!dashboardData?.latestInsight
  const highlightGenerate = hasAccounts && hasSynced && !hasInsight
  /*
   * Overview only shows Connect/Sync when the user actually needs them —
   * otherwise the home job is “open your week,” not bank maintenance.
   */
  const showOverviewConnect = !hasAccounts
  const showOverviewSync =
    hasAccounts &&
    (!hasSynced || hoursSinceSync(dashboardData?.lastSyncedAt) >= SYNC_STALE_HOURS)

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
  const activationComplete = buildActivationChecklist({
    userId,
    hasAccounts,
    paydayConfigured: Boolean(trackerData?.payday?.configured),
  }).isComplete

  const { data: expenseAnalyzerData, isPending: expenseAnalyzerLoading } = useQuery({
    queryKey: expenseAnalyzerQueryKey,
    queryFn: () => fetchExpenseAnalyzer(getToken),
    enabled: hasAccounts && activeTab === DASHBOARD_TABS.TOOLS,
  })

  const forecastEnabled = hasAccounts

  const {
    data: forecastData,
    isPending: forecastQueryPending,
    isError: forecastIsError,
    error: forecastError,
    refetch: refetchForecast,
  } = useQuery({
    queryKey: cashFlowForecastQueryKey,
    queryFn: () => fetchCashFlowForecast(getToken),
    enabled: forecastEnabled,
  })

  const forecastLoading = forecastEnabled && forecastQueryPending && forecastData === undefined
  const toolsForecastLoading =
    activeTab === DASHBOARD_TABS.TOOLS &&
    quickToolsTab === QUICK_TOOL_TABS.FORECAST &&
    forecastLoading

  const quickToolsLoading = expenseAnalyzerLoading && expenseAnalyzerData === undefined

  const { data: notificationsData } = useQuery({
    queryKey: notificationsUnreadQueryKey,
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
      percentUsed: trackerData?.percentUsed ?? trackerData?.spendingTracker?.progress?.percentUsed ?? 0,
      isOverBudget: trackerData?.isOverBudget ?? trackerData?.spendingTracker?.progress?.isOver ?? false,
      overBudgetBy: trackerData?.overBudgetBy ?? trackerData?.spendingTracker?.progress?.overBy ?? 0,
    }),
    [
      dashboardData?.lastSyncedAt,
      incompleteActionCount,
      trackerData?.periodStart,
      trackerData?.percentUsed,
      trackerData?.isOverBudget,
      trackerData?.overBudgetBy,
      trackerData?.spendingTracker?.progress?.percentUsed,
      trackerData?.spendingTracker?.progress?.isOver,
      trackerData?.spendingTracker?.progress?.overBy,
    ]
  )

  const visibleAttentionItems = useMemo(
    () => filterDismissedAttentionItems(attentionItems, attentionContext, userId),
    [attentionItems, attentionContext, attentionDismissalVersion, userId]
  )

  const showAttentionAllClear = hasAccounts && visibleAttentionItems.length === 0

  async function handleDismissAttentionItem(item) {
    dismissAttentionItem(item, attentionContext, userId)

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
              onOpenFloatingChat={(prompt = '') => {
                openChat({ prompt, autoSend: Boolean(prompt) })
              }}
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
                  onUpgrade={() => handleUpgrade('dashboard_paywall')}
                />
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  const overviewSetupPending = !activationComplete
  const insightAttentionPending = !hasInsight || incompleteActionCount > 0

  const showSkeleton = isPending && dashboardData === undefined
  const showFailedState = isError && dashboardData === undefined && !isPending

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar />

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
              <p className="text-left text-lg font-semibold tracking-tight text-fg sm:text-xl">
                {homeGreeting}
              </p>

              <DashboardHero
                hasAccounts={hasAccounts}
                totalBalance={dashboardData?.totalBalance ?? 0}
                lastSyncedAt={dashboardData?.lastSyncedAt}
                selectedRange={selectedRange}
                onRangeChange={setSelectedRange}
                income={dashboardData?.income ?? 0}
                spent={dashboardData?.spent ?? 0}
                cashFlow={dashboardData?.cashFlow ?? null}
                spendingSeries={dashboardData?.spendingSeries ?? []}
                trackerSnapshot={trackerData}
                trackerLoading={trackerLoading}
              />

              <DashboardActionsSection
                showToast={showToast}
                highlightedConnect={!hasAccounts}
                showConnectBank={showOverviewConnect}
                showSync={showOverviewSync}
                showGenerateInsight={false}
              />

              {hasAccounts && (
                <DashboardConnectedAccounts accounts={dashboardData?.accounts ?? []} />
              )}

              {!isPro && (
                <FreeVsProPlanCallout
                  onUpgrade={() => handleUpgrade('dashboard_overview')}
                />
              )}

              <DashboardNeedsAttention
                items={visibleAttentionItems}
                getToken={getToken}
                onSwitchTab={setActiveTab}
                onQuickToolTabChange={setQuickToolsTab}
                onDismiss={handleDismissAttentionItem}
                onAllClear={showAttentionAllClear}
              />

              {hasAccounts && (
                <Link
                  to="/weekly-review"
                  className="flex items-center justify-between gap-3 rounded-xl border border-ai/30 bg-ai/10 px-4 py-3.5 transition hover:bg-ai/15"
                >
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-fg">Open your week</p>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      What’s left until payday, and one better move
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-ai-soft">Open →</span>
                </Link>
              )}

              {hasAccounts && (
                <>
                  <DashboardUpcomingBills
                    forecast={forecastData}
                    isLoading={forecastLoading}
                    onOpenForecast={() => {
                      setActiveTab(DASHBOARD_TABS.TOOLS)
                      setQuickToolsTab(QUICK_TOOL_TABS.FORECAST)
                      requestAnimationFrame(() => {
                        document.getElementById('dashboard-quick-tools')?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      })
                    }}
                  />

                  <DashboardSpendingSnapshot
                    summary={expenseTeaser}
                    isLoading={expenseTeaserLoading}
                  />
                </>
              )}

              {hasAccounts && (
                <div className="mx-auto max-w-xl space-y-4">
                  {/*
                   * One setup surface on Overview: ActivationChecklist only.
                   * Insight onboarding stays on the Insight tab.
                   */}
                  <ActivationChecklist
                    hasAccounts={hasAccounts}
                    paydayConfigured={Boolean(trackerData?.payday?.configured)}
                  />
                  {!hasInsight && <SecurityNote />}
                </div>
              )}

              {!hasAccounts && (
                <div className="mx-auto max-w-xl space-y-4">
                  <ActivationChecklist
                    hasAccounts={hasAccounts}
                    paydayConfigured={false}
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
                  <div className="mx-auto mt-4 max-w-xs">
                    <ConnectBankButton showSecurityNote={false} />
                  </div>
                </div>
              )}

              {hasAccounts && (
                <DashboardQuickTools
                  accounts={dashboardData?.accounts ?? []}
                  lastSyncedAt={dashboardData?.lastSyncedAt}
                  expenseData={expenseAnalyzerData}
                  cashFlowActivity={dashboardData?.cashFlow?.activity ?? null}
                  trackerSnapshot={trackerData}
                  forecast={forecastData}
                  trackerLoading={trackerLoading}
                  trackerError={trackerIsError ? trackerError?.message : null}
                  forecastLoading={toolsForecastLoading}
                  forecastError={forecastIsError ? forecastError?.message : null}
                  onRetryTracker={() => refetchTrackers()}
                  onRetryForecast={() => refetchForecast()}
                  getToken={getToken}
                  activeTab={quickToolsTab}
                  onTabChange={setQuickToolsTab}
                  isLoading={quickToolsLoading}
                  isPro={isPro}
                  onUpgrade={() => handleUpgrade('quick_tools_tracker')}
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
        getToken={getToken}
        isPro={isPro}
        onClose={handleFirstConnectClose}
        onGenerateInsight={handleFirstConnectGenerate}
        onPaydaySaved={() => {
          queryClient.invalidateQueries({ queryKey: paydayQueryKey })
          queryClient.invalidateQueries({ queryKey: trackerQueryKey })
        }}
        onGoalCreated={() => {
          queryClient.invalidateQueries({ queryKey: trackerQueryKey })
          showToast('Cash buffer goal created', 'success')
        }}
      />

    </div>
  )
}

export default DashboardPage
