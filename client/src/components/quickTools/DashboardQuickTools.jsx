/*
 * DASHBOARD QUICK TOOLS
 *
 * Tabbed shortcuts — recent transactions, account health, and monthly tracker.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../Skeleton.jsx'
import TrackerToolPanel from './TrackerToolPanel.jsx'
import ForecastToolPanel from './ForecastToolPanel.jsx'
import BeforeYouSpendPanel from './BeforeYouSpendPanel.jsx'
import {
  assessAccountHealth,
  collectRecentTransactions,
  formatQuickToolDate,
  formatRelativeSync,
  QUICK_TOOL_TABS,
} from '../../lib/quickTools.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/*
 * Tab switcher for Quick tools.
 *
 * Why a grid on small screens:
 * Five equal tabs in one row need horizontal scroll on phones.
 * A 3-column wrap shows every tool at once (3 on the first row, 2 on the
 * second) with short labels. From sm and up we switch back to a single
 * equal-width row with the fuller labels.
 */
function QuickToolsTabBar({ activeTab, onChange }) {
  const tabs = [
    { id: QUICK_TOOL_TABS.RECENT, label: 'Recent', shortLabel: 'Recent' },
    { id: QUICK_TOOL_TABS.HEALTH, label: 'Health', shortLabel: 'Health' },
    { id: QUICK_TOOL_TABS.TRACKER, label: 'Tracker', shortLabel: 'Tracker' },
    { id: QUICK_TOOL_TABS.FORECAST, label: 'Forecast', shortLabel: 'Forecast' },
    { id: QUICK_TOOL_TABS.SPEND, label: 'Can I afford it?', shortLabel: 'Afford' },
  ]

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl border border-border-default bg-app/60 p-1 sm:flex"
      role="tablist"
      aria-label="Quick tools"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`quick-tool-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`quick-tool-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`min-h-10 rounded-lg px-2 py-2 text-center text-xs font-semibold transition sm:min-w-0 sm:flex-1 sm:px-3 sm:text-sm ${
              isActive
                ? 'bg-surface-elevated text-fg shadow-sm ring-1 ring-brand/30'
                : 'text-fg-muted hover:bg-surface-elevated/60 hover:text-fg'
            }`}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/*
 * Keep every tab panel mounted, but hide inactive ones.
 *
 * Why: Tracker create/edit forms live in React state. Returning null on
 * inactive tabs unmounted those forms and wiped half-finished drafts when
 * people hopped to Forecast and back.
 *
 * Concept: "display:none" vs unmount — hidden DOM still keeps component state;
 * null destroys it. Hidden inactive panels also stay out of the accessibility
 * tree via hidden + inert-friendly attributes.
 */
function QuickToolPanel({ tabId, activeTab, children }) {
  const isActive = activeTab === tabId

  return (
    <div
      id={`quick-tool-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`quick-tool-tab-${tabId}`}
      aria-hidden={!isActive}
      hidden={!isActive}
      tabIndex={isActive ? 0 : -1}
      className={isActive ? 'mt-4 outline-none' : 'hidden'}
    >
      {children}
    </div>
  )
}

function RecentTransactionsPanel({ transactions, isLoading }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div>
        <p className="text-sm text-fg-muted">No recent activity yet. Sync your accounts to see money in and out.</p>
        <Link to="/expense-analyzer?tab=categories" className="mt-3 inline-flex text-sm font-medium text-ai-soft hover:underline">
          Browse categories →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-border-default/80">
        {transactions.map((transaction) => {
          const isInflow = transaction.direction === 'in'
          const isMoved =
            transaction.kind === 'internal_transfer' ||
            transaction.kind === 'liability_payment'
          const amountClass = isMoved
            ? 'text-fg-subtle'
            : isInflow
              ? 'text-brand-soft'
              : 'text-fg'
          const prefix = isMoved ? '' : isInflow ? '+' : '−'

          return (
            <li
              key={`${transaction.kind}-${transaction.name}-${transaction.date}-${transaction.category}`}
              className="flex justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{transaction.name}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {formatQuickToolDate(transaction.date)}
                  {transaction.badge ? ` · ${transaction.badge}` : ''}
                  {transaction.category && !transaction.badge
                    ? ` · ${transaction.category}`
                    : ''}
                </p>
              </div>
              <span className={`font-mono text-sm tabular-nums ${amountClass}`}>
                {prefix}
                {formatCurrency(transaction.amount)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AccountHealthPanel({ accounts, lastSyncedAt, isLoading }) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }

  const health = assessAccountHealth(accounts, lastSyncedAt)

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-3 py-3 ${health.syncStale ? 'border-warning/30 bg-warning/5' : 'border-brand/20 bg-brand/5'}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Sync status</p>
        <p className="mt-1 text-sm font-medium text-fg">{formatRelativeSync(lastSyncedAt)}</p>
      </div>
      <ul className="divide-y divide-border-default/80">
        {health.accountStatuses.map(({ account, status, message, balance }) => (
          <li key={account.id} className="flex justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{account.account_name}</p>
              <p className="text-xs text-fg-subtle">{account.bank_name} · {message}</p>
            </div>
            <p className={`font-mono text-sm tabular-nums ${status === 'warning' ? 'text-danger' : 'text-brand-soft'}`}>
              {formatCurrency(balance)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DashboardQuickTools({
  accounts = [],
  lastSyncedAt,
  expenseData,
  trackerSnapshot,
  forecast,
  trackerLoading = false,
  trackerError = null,
  forecastLoading = false,
  forecastError = null,
  onRetryTracker,
  onRetryForecast,
  getToken,
  activeTab: controlledTab,
  onTabChange,
  isLoading = false,
  isPro = false,
  onUpgrade,
}) {
  const [internalTab, setInternalTab] = useState(QUICK_TOOL_TABS.RECENT)
  const activeTab = controlledTab ?? internalTab

  function handleTabChange(tabId) {
    if (onTabChange) {
      onTabChange(tabId)
    } else {
      setInternalTab(tabId)
    }
  }

  const recentTransactions = collectRecentTransactions(
    expenseData?.categoryBreakdown,
    8,
    expenseData?.recentCashFlowActivity
  )

  return (
    <section id="dashboard-quick-tools" className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <p className="text-sm text-fg-muted">
        Recent activity, trackers, forecast, and “Can I afford it?”
      </p>
      <div className="mt-4">
        <QuickToolsTabBar activeTab={activeTab} onChange={handleTabChange} />
      </div>

      <QuickToolPanel tabId={QUICK_TOOL_TABS.RECENT} activeTab={activeTab}>
        <RecentTransactionsPanel transactions={recentTransactions} isLoading={isLoading} />
      </QuickToolPanel>

      <QuickToolPanel tabId={QUICK_TOOL_TABS.HEALTH} activeTab={activeTab}>
        <AccountHealthPanel accounts={accounts} lastSyncedAt={lastSyncedAt} isLoading={isLoading} />
      </QuickToolPanel>

      <QuickToolPanel tabId={QUICK_TOOL_TABS.TRACKER} activeTab={activeTab}>
        <TrackerToolPanel
          snapshot={trackerSnapshot}
          isLoading={trackerLoading}
          loadError={trackerError}
          onRetryLoad={onRetryTracker}
          getToken={getToken}
          isPro={isPro}
          onUpgrade={onUpgrade}
        />
      </QuickToolPanel>

      <QuickToolPanel tabId={QUICK_TOOL_TABS.FORECAST} activeTab={activeTab}>
        <ForecastToolPanel
          forecast={forecast}
          isLoading={forecastLoading}
          loadError={forecastError}
          onRetryLoad={onRetryForecast}
        />
      </QuickToolPanel>

      <QuickToolPanel tabId={QUICK_TOOL_TABS.SPEND} activeTab={activeTab}>
        <BeforeYouSpendPanel
          getToken={getToken}
          softLimits={trackerSnapshot?.categorySoftLimits ?? []}
          paydayConfigured={Boolean(trackerSnapshot?.payday?.configured)}
        />
      </QuickToolPanel>
    </section>
  )
}

export default DashboardQuickTools
