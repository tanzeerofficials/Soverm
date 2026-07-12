/*
 * EXPENSE ANALYZER PAGE
 *
 * Category spending breakdown with MoM deltas, top mover callout,
 * and detected recurring charges.
 */

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProactiveNoticeBanner from '../components/ProactiveNoticeBanner.jsx'
import ExpenseAnalyzerNarrativeSection from '../components/ExpenseAnalyzerNarrativeSection.jsx'
import ExpenseAnalyzerVisuals from '../components/expenseAnalyzer/ExpenseAnalyzerVisuals.jsx'
import {
  EXPENSE_ANALYZER_TABS,
  ExpenseAnalyzerTabBar,
  ExpenseAnalyzerTabPanel,
} from '../components/expenseAnalyzer/ExpenseAnalyzerTabs.jsx'
import HeadlineTypeBadge from '../components/HeadlineTypeBadge.jsx'
import StatDeltaBadge from '../components/StatDeltaBadge.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { expenseAnalyzerQueryKey, trackerQueryKey, categoryLimitsQueryKey } from '../lib/queryKeys.js'
import { fetchExpenseAnalyzer } from '../lib/fetchExpenseAnalyzer.js'
import { annualizeRecurringMonthly } from '../lib/recurringAnnual.js'
import {
  buildTopMoverHeadline,
  isNotableTopMover,
  topMoverHeadlineStyles,
} from '../lib/topMover.js'
import {
  AccountSourceLine,
  CategoryMetaBadges,
  CategoryRecurringLine,
  formatCategoryDisplayName,
  formatCategoryAccountSources,
  formatRecurringAccountSource,
  formatCurrency,
} from '../components/expenseAnalyzer/ExpenseAnalyzerDisplay.jsx'
import { upsertCategoryLimit, fetchCategoryLimits, deleteCategoryLimit } from '../lib/fetchCategoryLimits.js'
import CategorySoftLimitControl, {
  CategorySoftLimitsIntro,
} from '../components/CategorySoftLimitControl.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import {
  buildCancelKeepWatchPrompt,
  buildRecurringPortfolioPrompt,
  buildRecurringReviewPrompt,
} from '../lib/chatSuggestedPrompts.js'
import BillDefenseSection from '../components/BillDefenseSection.jsx'

function formatChargeDate(dateString) {
  if (!dateString) {
    return '—'
  }

  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCadenceLabel(cadence) {
  switch (cadence) {
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Biweekly'
    case 'annual':
      return 'Annual'
    default:
      return 'Monthly'
  }
}

function formatRecurringSourceLabel(source) {
  switch (source) {
    case 'plaid':
      return 'Plaid verified'
    case 'both':
      return 'Plaid + detected'
    default:
      return 'Detected pattern'
  }
}

function formatOverallRecurringLine(recurringMonthly) {
  if (!recurringMonthly || recurringMonthly <= 0) {
    return null
  }

  return `Recurring: ${formatCurrency(recurringMonthly)}/mo`
}

function RecurringChargeCard({ charge, variant = 'confirmed', onAskSoverm }) {
  const borderClass =
    variant === 'review'
      ? 'border-warning/30 border-l-warning bg-surface'
      : 'border-border-default border-l-ai bg-surface'
  const accountSource = formatRecurringAccountSource(charge)
  const displayCategory = charge.category
    ? formatCategoryDisplayName(charge.category)
    : null
  const monthlyAmount = charge.monthlyEquivalent ?? charge.averageAmount

  return (
    <li className={`rounded-xl border border-l-4 px-4 py-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-fg">{charge.merchant}</p>
            {charge.confidence && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeStyles(charge.confidence)}`}
              >
                {formatConfidenceLabel(charge.confidence)}
              </span>
            )}
          </div>

          {charge.detectionReason?.summary && (
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              {charge.detectionReason.summary}
            </p>
          )}

          {typeof charge.amountDelta === 'number' &&
            charge.amountDelta >= 1 &&
            charge.firstAmount > 0 && (
              <p className="mt-1.5 text-xs font-medium text-warning">
                Price up {formatCurrency(charge.amountDelta)} from{' '}
                {formatCurrency(charge.firstAmount)} → {formatCurrency(charge.lastAmount)}
              </p>
            )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span className="text-ai">{formatCadenceLabel(charge.cadence)}</span>
            {displayCategory && (
              <>
                <span className="text-fg-subtle" aria-hidden="true">
                  ·
                </span>
                <span>{displayCategory}</span>
              </>
            )}
            {charge.source && (
              <>
                <span className="text-fg-subtle" aria-hidden="true">
                  ·
                </span>
                <span>{formatRecurringSourceLabel(charge.source)}</span>
              </>
            )}
          </div>

          <AccountSourceLine sources={accountSource} />

          {charge.detectionReason?.detail && (
            <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
              {charge.detectionReason.detail}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-xl font-bold tabular-nums text-fg">
            {formatCurrency(charge.averageAmount)}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {formatCurrency(monthlyAmount)}/mo eq.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3">
        <p className="text-xs text-fg-subtle">
          {charge.occurrenceCount} charge{charge.occurrenceCount === 1 ? '' : 's'} · last{' '}
          {formatChargeDate(charge.lastChargedDate)} · next{' '}
          {formatChargeDate(charge.nextExpectedDate)}
        </p>
        {onAskSoverm && (
          <button
            type="button"
            onClick={() => onAskSoverm(charge)}
            className="rounded-lg border border-ai/40 bg-ai/10 px-3 py-1.5 text-xs font-semibold text-ai transition hover:bg-ai/20"
          >
            Ask Soverm
          </button>
        )}
      </div>
    </li>
  )
}

function formatConfidenceLabel(confidence) {
  switch (confidence) {
    case 'high':
      return 'Confirmed'
    case 'medium':
      return 'Likely'
    case 'low':
      return 'Uncertain'
    default:
      return confidence
  }
}

function confidenceBadgeStyles(confidence) {
  switch (confidence) {
    case 'high':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    default:
      return 'border-orange-500/30 bg-orange-500/10 text-orange-200'
  }
}

function formatOverallSpendingLine(overallSpending) {
  if (!overallSpending?.hasComparisonData || !overallSpending.delta) {
    return null
  }

  const { currentTotal, priorTotal, delta } = overallSpending

  if (delta.direction === 'flat') {
    return `You spent ${formatCurrency(currentTotal)} in the last 30 days — flat vs the prior 30 days (${formatCurrency(priorTotal)}).`
  }

  if (delta.percent == null && delta.times == null) {
    return `You spent ${formatCurrency(currentTotal)} in the last 30 days.`
  }

  const times =
    delta.times ??
    (priorTotal > 0 ? currentTotal / priorTotal : null)
  const timesLabel =
    times == null
      ? null
      : times >= 10
        ? `${Math.round(times)}×`
        : `${(Math.round(times * 10) / 10).toFixed(1).replace(/\.0$/, '')}×`
  const signedChange =
    delta.absoluteChange != null
      ? `${delta.direction === 'down' ? '−' : '+'}${formatCurrency(delta.absoluteChange)}`
      : null

  if (timesLabel) {
    return `You spent ${formatCurrency(currentTotal)} in the last 30 days — about ${timesLabel} the prior 30 days (${formatCurrency(priorTotal)}${signedChange ? `, ${signedChange}` : ''}).`
  }

  return `You spent ${formatCurrency(currentTotal)} in the last 30 days vs ${formatCurrency(priorTotal)} in the prior 30 days.`
}

function ExpenseAnalyzerPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [activeTab, setActiveTab] = useState(EXPENSE_ANALYZER_TABS.OVERVIEW)
  const [limitSaving, setLimitSaving] = useState(false)

  const tabParam = searchParams.get('tab')
  const highlightCategory = searchParams.get('highlight')

  /*
   * What this does: opens dashboard Ask Soverm with a starter prompt.
   * Why: subscription review should jump from RECURRING cards into chat
   * without forcing the user to invent the question.
   */
  function openChatWithPrompt(prompt) {
    const params = new URLSearchParams({ chat: 'open' })
    if (prompt) {
      params.set('prompt', prompt)
    }
    navigate(`/dashboard?${params.toString()}`)
  }

  function handleAskAboutCharge(charge) {
    openChatWithPrompt(buildRecurringReviewPrompt(charge))
  }

  function handleAskAboutFinding(finding) {
    openChatWithPrompt(finding.reviewPrompt || buildCancelKeepWatchPrompt(finding))
  }

  function handleReviewAllSubscriptions() {
    openChatWithPrompt(buildRecurringPortfolioPrompt())
  }

  async function handleSaveCategoryLimit({ category, monthlyLimit }) {
    setLimitSaving(true)
    try {
      await upsertCategoryLimit(getToken, {
        category,
        monthlyLimit,
        alertWarningPercent: 80,
      })
      showToast(`Soft limit set for ${formatCategoryDisplayName(category)}`, 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
        queryClient.invalidateQueries({ queryKey: categoryLimitsQueryKey }),
      ])
    } catch (err) {
      showToast(err.message || 'Couldn’t save category limit', 'error')
      throw err
    } finally {
      setLimitSaving(false)
    }
  }

  async function handleRemoveCategoryLimit(limitId) {
    setLimitSaving(true)
    try {
      await deleteCategoryLimit(getToken, limitId)
      showToast('Category limit removed', 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
        queryClient.invalidateQueries({ queryKey: categoryLimitsQueryKey }),
      ])
    } catch (err) {
      showToast(err.message || 'Couldn’t remove category limit', 'error')
      throw err
    } finally {
      setLimitSaving(false)
    }
  }

  useEffect(() => {
    const tabMap = {
      overview: EXPENSE_ANALYZER_TABS.OVERVIEW,
      summary: EXPENSE_ANALYZER_TABS.SUMMARY,
      categories: EXPENSE_ANALYZER_TABS.CATEGORIES,
      recurring: EXPENSE_ANALYZER_TABS.RECURRING,
    }

    if (tabParam && tabMap[tabParam]) {
      setActiveTab(tabMap[tabParam])
    }
  }, [tabParam])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: expenseAnalyzerQueryKey,
    queryFn: () => fetchExpenseAnalyzer(getToken),
  })

  const { data: categoryLimits = [] } = useQuery({
    queryKey: categoryLimitsQueryKey,
    queryFn: () => fetchCategoryLimits(getToken),
  })

  const limitsByCategory = useMemo(
    () => new Map(categoryLimits.map((limit) => [limit.category, limit])),
    [categoryLimits]
  )

  const categoryBreakdown = data?.categoryBreakdown ?? []
  const recurringCharges = data?.recurringCharges ?? []
  const reviewCharges = data?.reviewCharges ?? []
  const billDefense = data?.billDefense ?? []
  const topMover = isNotableTopMover(data?.topMover) ? data.topMover : null
  const topMoverHeadline = topMover
    ? buildTopMoverHeadline({
        ...topMover,
        displayCategory: formatCategoryDisplayName(topMover.category),
      })
    : null
  const totalRecurringMonthly = data?.totalRecurringMonthly ?? 0

  useEffect(() => {
    if (!highlightCategory || !data?.categoryBreakdown?.length) {
      return
    }

    setActiveTab(EXPENSE_ANALYZER_TABS.CATEGORIES)
    setExpandedCategory(highlightCategory)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('highlight')
    setSearchParams(nextParams, { replace: true })
  }, [highlightCategory, data?.categoryBreakdown, searchParams, setSearchParams])
  const totalRecurringAnnual = annualizeRecurringMonthly(totalRecurringMonthly)
  const totalReviewMonthly = data?.totalReviewMonthly ?? 0
  const overallSpending = data?.overallSpending ?? null
  const narrativeSummary = data?.narrativeSummary ?? null
  const narrativeMeta = data?.narrativeMeta ?? null
  const latestInsightId = data?.latestInsightId ?? null
  const overallSpendingLine = formatOverallSpendingLine(overallSpending)
  const overallRecurringLine = formatOverallRecurringLine(
    overallSpending?.recurringMonthly ?? totalRecurringMonthly
  )

  function categoryHasDrillDown(entry) {
    return (
      (entry.recurringCharges?.length ?? 0) > 0 ||
      (entry.recentTransactions?.length ?? 0) > 0
    )
  }

  function toggleCategoryExpansion(category) {
    const entry = categoryBreakdown.find((row) => row.category === category)
    if (!entry || !categoryHasDrillDown(entry)) {
      return
    }

    setExpandedCategory((current) => (current === category ? null : category))
  }

  const topMoverStyles = topMoverHeadline ? topMoverHeadlineStyles(topMover.direction) : null

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        onChatClick={() => navigate('/dashboard?chat=open')}
      />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader title="Expense Analyzer" description="Where your money actually goes — compared to the prior 30 days.">
          {overallSpendingLine && (
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{overallSpendingLine}</p>
          )}
          {overallRecurringLine && (
            <p className="mt-2 text-sm text-ai">{overallRecurringLine}</p>
          )}
        </PageHeader>

        <ProactiveNoticeBanner />

        {isLoading ? (
          <div className="space-y-6 sm:space-y-8" aria-busy="true" aria-label="Loading expense analyzer">
            <div className="flex gap-1.5 overflow-hidden rounded-2xl border border-border-default bg-surface p-1.5">
              <Skeleton className="h-14 min-w-[5.75rem] flex-1 rounded-xl" />
              <Skeleton className="h-14 min-w-[5.75rem] flex-1 rounded-xl" />
              <Skeleton className="h-14 min-w-[5.75rem] flex-1 rounded-xl" />
              <Skeleton className="hidden h-14 flex-1 rounded-xl sm:block" />
            </div>
            <Skeleton className="h-72 w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-border-default bg-surface px-6 py-10 text-center">
            <p className="text-sm text-fg-muted">
              Couldn&apos;t load your expense breakdown. Please try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-lg border border-border-default bg-surface-elevated px-4 py-2 text-sm font-medium text-fg transition hover:border-border-hover"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <ExpenseAnalyzerTabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              categoryCount={categoryBreakdown.length}
              recurringCount={recurringCharges.length}
              summaryReady={Boolean(narrativeSummary || narrativeMeta?.fingerprint)}
            />

            <ExpenseAnalyzerTabPanel
              tabId={EXPENSE_ANALYZER_TABS.OVERVIEW}
              activeTab={activeTab}
              className="space-y-6"
            >
              <ExpenseAnalyzerVisuals
                categoryBreakdown={categoryBreakdown}
                overallSpending={overallSpending}
                recurringCharges={recurringCharges}
                totalRecurringMonthly={totalRecurringMonthly}
              />

              {topMoverHeadline && topMoverStyles && (
                <section
                  className="rounded-xl border border-border-default bg-surface p-5 sm:p-6"
                  aria-label="Top spending mover"
                >
                  <HeadlineTypeBadge variant={topMoverStyles.badgeVariant} className="mb-3" />
                  <p
                    className={`break-words text-xl font-bold leading-snug sm:text-2xl ${topMoverStyles.color}`}
                  >
                    {topMoverHeadline}
                  </p>
                </section>
              )}
            </ExpenseAnalyzerTabPanel>

            <ExpenseAnalyzerTabPanel
              tabId={EXPENSE_ANALYZER_TABS.SUMMARY}
              activeTab={activeTab}
            >
              {(narrativeSummary || narrativeMeta) ? (
                <ExpenseAnalyzerNarrativeSection
                  templateSummary={narrativeSummary}
                  narrativeMeta={narrativeMeta}
                  totalRecurringMonthly={totalRecurringMonthly}
                  latestInsightId={latestInsightId}
                  onChatError={(message) => showToast(message, 'error')}
                />
              ) : (
                <div className="rounded-xl border border-border-default bg-surface px-6 py-12 text-center">
                  <p className="text-sm leading-relaxed text-fg-muted">
                    Connect a bank and sync transactions to unlock your expense summary and Ask
                    Soverm chat.
                  </p>
                  <Link
                    to="/dashboard"
                    className="mt-4 inline-flex rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              )}
            </ExpenseAnalyzerTabPanel>

            <ExpenseAnalyzerTabPanel
              tabId={EXPENSE_ANALYZER_TABS.CATEGORIES}
              activeTab={activeTab}
            >
              <section aria-label="Category breakdown">
                {categoryBreakdown.length === 0 ? (
                  <div className="rounded-xl border border-border-default bg-surface px-6 py-10 text-center">
                    <p className="text-sm leading-relaxed text-fg-muted">
                      Connect a bank and sync transactions to see your expense breakdown.
                    </p>
                    <Link
                      to="/dashboard"
                      className="mt-4 inline-flex rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Go to Dashboard
                    </Link>
                  </div>
                ) : (
                  <>
                  <CategorySoftLimitsIntro activeCount={categoryLimits.length} />
                  <ul className="space-y-3">
                  {[...categoryBreakdown]
                    .sort((left, right) => right.currentTotal - left.currentTotal)
                    .map((entry) => {
                      const matchingCharges = entry.recurringCharges ?? []
                      const recentTransactions = entry.recentTransactions ?? []
                      const accountSources = formatCategoryAccountSources(entry.accountBreakdown)
                      const displayCategory = formatCategoryDisplayName(entry.category)
                      const isExpandable = categoryHasDrillDown(entry)
                      const isExpanded = expandedCategory === entry.category

                      return (
                        <li key={entry.category}>
                          <div
                            className={`rounded-xl border border-border-default bg-surface px-4 py-4 ${
                              isExpandable
                                ? 'cursor-pointer transition hover:border-border-hover hover:bg-surface-elevated'
                                : ''
                            }`}
                            role={isExpandable ? 'button' : undefined}
                            tabIndex={isExpandable ? 0 : undefined}
                            aria-expanded={isExpandable ? isExpanded : undefined}
                            onClick={() => toggleCategoryExpansion(entry.category)}
                            onKeyDown={(event) => {
                              if (!isExpandable) {
                                return
                              }

                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggleCategoryExpansion(entry.category)
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div>
                                  <p className="text-base font-semibold text-fg">
                                    {displayCategory}
                                  </p>
                                  <CategoryMetaBadges
                                    percentOfTotal={entry.percentOfTotal}
                                    recurringCount={matchingCharges.length}
                                  />
                                </div>

                                <AccountSourceLine sources={accountSources} />

                                <CategoryRecurringLine
                                  recurringMonthly={entry.recurringMonthly ?? 0}
                                />

                                <CategorySoftLimitControl
                                  category={entry.category}
                                  displayName={displayCategory}
                                  limit={limitsByCategory.get(entry.category) ?? null}
                                  activeLimitCount={categoryLimits.length}
                                  spendHint={entry.currentTotal}
                                  onSave={handleSaveCategoryLimit}
                                  onRemove={handleRemoveCategoryLimit}
                                  isSaving={limitSaving}
                                />
                              </div>

                              <div className="flex min-w-0 shrink-0 flex-col items-end gap-2">
                                <p className="font-mono text-xl font-bold tabular-nums text-fg">
                                  {formatCurrency(entry.currentTotal)}
                                </p>
                                {entry.delta && (
                                  <StatDeltaBadge
                                    delta={entry.delta}
                                    statType="spending"
                                    inline
                                  />
                                )}
                                {isExpandable && (
                                  <svg
                                    className={`h-4 w-4 text-fg-muted transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-4 rounded-xl border border-border-default/70 bg-app/40 px-4 py-4">
                              {recentTransactions.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                                    Recent transactions
                                  </p>
                                  <ul className="mt-3 divide-y divide-border-default/80">
                                    {recentTransactions.map((transaction) => (
                                      <li
                                        key={`${entry.category}-${transaction.name}-${transaction.date}`}
                                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm text-fg">
                                            {transaction.name}
                                          </p>
                                          <p className="mt-0.5 text-xs text-fg-subtle">
                                            {formatChargeDate(transaction.date)}
                                            {transaction.accountLabel
                                              ? ` · ${transaction.accountLabel}`
                                              : ''}
                                          </p>
                                        </div>
                                        <span className="shrink-0 font-mono text-sm tabular-nums text-fg">
                                          {formatCurrency(transaction.amount)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {matchingCharges.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                                    Recurring in this category
                                  </p>
                                  <ul className="mt-3 space-y-2">
                                    {matchingCharges.map((charge) => {
                                      const chargeAccount = formatRecurringAccountSource(charge)

                                      return (
                                        <li
                                          key={`${entry.category}-${charge.merchant}-${charge.lastChargedDate}`}
                                          className="rounded-lg border border-border-default bg-surface px-3 py-3"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="font-medium text-fg">
                                                {charge.merchant}
                                              </p>
                                              <p className="mt-1 text-xs text-fg-subtle">
                                                {formatCadenceLabel(charge.cadence)}
                                                {charge.source
                                                  ? ` · ${formatRecurringSourceLabel(charge.source)}`
                                                  : ''}
                                              </p>
                                              <div className="mt-1">
                                                <AccountSourceLine sources={chargeAccount} />
                                              </div>
                                            </div>
                                            <span className="shrink-0 font-mono text-sm tabular-nums text-fg-muted">
                                              {formatCurrency(
                                                charge.monthlyEquivalent ?? charge.averageAmount
                                              )}
                                              /mo
                                            </span>
                                          </div>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                </ul>
                  </>
                )}
              </section>
            </ExpenseAnalyzerTabPanel>

            <ExpenseAnalyzerTabPanel
              tabId={EXPENSE_ANALYZER_TABS.RECURRING}
              activeTab={activeTab}
              className="space-y-8"
            >
              <BillDefenseSection
                findings={billDefense}
                invalidateKeys={[expenseAnalyzerQueryKey]}
                onAskSoverm={handleAskAboutFinding}
                title="Flags to review"
              />

              <section aria-label="Recurring charges">
                {recurringCharges.length > 0 && (
                  <>
                    <div className="rounded-xl border border-ai/30 bg-ai/10 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ai-soft">
                        Annual subscription cost
                      </p>
                      <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-fg">
                        {formatCurrency(totalRecurringAnnual)}/year
                      </p>
                      <p className="mt-1 text-sm text-fg-muted">
                        {formatCurrency(totalRecurringMonthly)}/mo
                        {recurringCharges.length === 1
                          ? ' · 1 confirmed subscription'
                          : ` · ${recurringCharges.length} confirmed subscriptions`}
                      </p>
                      <button
                        type="button"
                        onClick={handleReviewAllSubscriptions}
                        className="mt-4 rounded-lg bg-ai px-4 py-2 text-sm font-semibold text-app transition hover:brightness-110"
                      >
                        Review subscriptions with Soverm
                      </button>
                    </div>
                    <p className="mt-3 font-mono text-sm font-semibold text-fg-muted">
                      Total recurring: {formatCurrency(totalRecurringMonthly)}/mo
                    </p>
                  </>
                )}

                {recurringCharges.length === 0 ? (
                  <div className="rounded-xl border border-border-default bg-surface px-6 py-10 text-center">
                    <p className="text-sm leading-relaxed text-fg-muted">
                      No recurring charges detected yet — check back after a couple months of
                      transaction history.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {recurringCharges.map((charge) => (
                      <RecurringChargeCard
                        key={`${charge.merchant}-${charge.lastChargedDate}`}
                        charge={charge}
                        onAskSoverm={handleAskAboutCharge}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {reviewCharges.length > 0 && (
                <section aria-label="Review recurring patterns">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                        Review
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-muted">
                        These patterns might be subscriptions — or repeat one-offs (like frequent
                        rides or coffee). We don&apos;t count them in your recurring total until
                        there&apos;s stronger evidence.
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-amber-200">
                      If confirmed: {formatCurrency(totalReviewMonthly)}/mo
                    </p>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {reviewCharges.map((charge) => (
                      <RecurringChargeCard
                        key={`review-${charge.merchant}-${charge.lastChargedDate}`}
                        charge={charge}
                        variant="review"
                        onAskSoverm={handleAskAboutCharge}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </ExpenseAnalyzerTabPanel>
          </div>
        )}
      </main>
    </div>
  )
}

export default ExpenseAnalyzerPage
