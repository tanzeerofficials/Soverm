/*
 * EXPENSE ANALYZER PAGE
 *
 * Category spending breakdown with MoM deltas, top mover callout,
 * and detected recurring charges.
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import ExpenseAnalyzerNarrativeSection from '../components/ExpenseAnalyzerNarrativeSection.jsx'
import ExpenseAnalyzerVisuals from '../components/expenseAnalyzer/ExpenseAnalyzerVisuals.jsx'
import StatDeltaBadge from '../components/StatDeltaBadge.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { expenseAnalyzerQueryKey } from '../lib/queryKeys.js'
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

function RecurringChargeCard({ charge, variant = 'confirmed' }) {
  const borderClass =
    variant === 'review'
      ? 'border-amber-500/30 border-l-amber-500 bg-[#111827]'
      : 'border-[#1E2D45] border-l-[#8B5CF6] bg-[#111827]'
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
            <p className="text-base font-semibold text-[#F9FAFB]">{charge.merchant}</p>
            {charge.confidence && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeStyles(charge.confidence)}`}
              >
                {formatConfidenceLabel(charge.confidence)}
              </span>
            )}
          </div>

          {charge.detectionReason?.summary && (
            <p className="mt-1.5 text-sm leading-relaxed text-[#D1D5DB]">
              {charge.detectionReason.summary}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
            <span className="text-[#8B5CF6]">{formatCadenceLabel(charge.cadence)}</span>
            {displayCategory && (
              <>
                <span className="text-[#4B5563]" aria-hidden="true">
                  ·
                </span>
                <span>{displayCategory}</span>
              </>
            )}
            {charge.source && (
              <>
                <span className="text-[#4B5563]" aria-hidden="true">
                  ·
                </span>
                <span>{formatRecurringSourceLabel(charge.source)}</span>
              </>
            )}
          </div>

          <AccountSourceLine sources={accountSource} />

          {charge.detectionReason?.detail && (
            <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
              {charge.detectionReason.detail}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-xl font-bold tabular-nums text-[#F9FAFB]">
            {formatCurrency(charge.averageAmount)}
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            {formatCurrency(monthlyAmount)}/mo eq.
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-[#1E2D45] pt-3 text-xs text-[#6B7280]">
        {charge.occurrenceCount} charge{charge.occurrenceCount === 1 ? '' : 's'} · last{' '}
        {formatChargeDate(charge.lastChargedDate)} · next{' '}
        {formatChargeDate(charge.nextExpectedDate)}
      </p>
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

  if (delta.percent == null) {
    return `You spent ${formatCurrency(currentTotal)} in the last 30 days.`
  }

  return `You spent ${formatCurrency(currentTotal)} in the last 30 days, ${delta.direction} ${delta.percent}% vs the prior 30 days (${formatCurrency(priorTotal)}).`
}

function ExpenseAnalyzerPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [expandedCategory, setExpandedCategory] = useState(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: expenseAnalyzerQueryKey,
    queryFn: () => fetchExpenseAnalyzer(getToken),
  })

  const categoryBreakdown = data?.categoryBreakdown ?? []
  const recurringCharges = data?.recurringCharges ?? []
  const reviewCharges = data?.reviewCharges ?? []
  const topMover = isNotableTopMover(data?.topMover) ? data.topMover : null
  const topMoverHeadline = topMover
    ? buildTopMoverHeadline({
        ...topMover,
        displayCategory: formatCategoryDisplayName(topMover.category),
      })
    : null
  const totalRecurringMonthly = data?.totalRecurringMonthly ?? 0
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
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        onChatClick={() => navigate('/dashboard?chat=open')}
        leftContent={
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-[#9CA3AF] transition hover:text-white"
            >
              ← Back to Dashboard
            </Link>
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]">
              Soverm
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#F9FAFB]">Expense Analyzer</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Where your money actually goes — compared to the prior 30 days.
          </p>
          {overallSpendingLine && (
            <p className="mt-3 text-sm leading-relaxed text-[#D1D5DB]">{overallSpendingLine}</p>
          )}
          {overallRecurringLine && (
            <p className="mt-2 text-sm text-[#8B5CF6]">{overallRecurringLine}</p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-8" aria-busy="true" aria-label="Loading expense analyzer">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Couldn&apos;t load your expense breakdown. Please try again in a moment.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            <ExpenseAnalyzerVisuals
              categoryBreakdown={categoryBreakdown}
              overallSpending={overallSpending}
              recurringCharges={recurringCharges}
              totalRecurringMonthly={totalRecurringMonthly}
            />

            {(narrativeSummary || narrativeMeta) && (
              <ExpenseAnalyzerNarrativeSection
                templateSummary={narrativeSummary}
                narrativeMeta={narrativeMeta}
                totalRecurringMonthly={totalRecurringMonthly}
                latestInsightId={latestInsightId}
              />
            )}

            {topMoverHeadline && topMoverStyles && (
              <section
                className="rounded-xl border border-[#1E2D45] bg-[#111827] p-5 sm:p-6"
                aria-label="Top spending mover"
              >
                <p
                  className={`break-words text-xl font-bold leading-snug sm:text-2xl ${topMoverStyles.color}`}
                >
                  <span className="mr-2">{topMoverStyles.icon}</span>
                  {topMoverHeadline}
                </p>
              </section>
            )}

            <section aria-label="Category breakdown">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                Category breakdown
              </h2>

              {categoryBreakdown.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
                  <p className="text-sm leading-relaxed text-[#9CA3AF]">
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
                <ul className="mt-4 space-y-3">
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
                            className={`rounded-xl border border-[#1E2D45] bg-[#111827] px-4 py-4 ${
                              isExpandable
                                ? 'cursor-pointer transition hover:border-[#2D3A52] hover:bg-[#1A2236]'
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
                                  <p className="text-base font-semibold text-[#F9FAFB]">
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
                              </div>

                              <div className="flex min-w-0 shrink-0 flex-col items-end gap-2">
                                <p className="font-mono text-xl font-bold tabular-nums text-[#F9FAFB]">
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
                                    className={`h-4 w-4 text-[#9CA3AF] transition-transform ${
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
                            <div className="mt-2 space-y-4 rounded-xl border border-[#1E2D45]/70 bg-[#0A0F1C]/40 px-4 py-4">
                              {recentTransactions.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                                    Recent transactions
                                  </p>
                                  <ul className="mt-3 divide-y divide-[#1E2D45]/80">
                                    {recentTransactions.map((transaction) => (
                                      <li
                                        key={`${entry.category}-${transaction.name}-${transaction.date}`}
                                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm text-[#E5E7EB]">
                                            {transaction.name}
                                          </p>
                                          <p className="mt-0.5 text-xs text-[#6B7280]">
                                            {formatChargeDate(transaction.date)}
                                            {transaction.accountLabel
                                              ? ` · ${transaction.accountLabel}`
                                              : ''}
                                          </p>
                                        </div>
                                        <span className="shrink-0 font-mono text-sm tabular-nums text-[#F9FAFB]">
                                          {formatCurrency(transaction.amount)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {matchingCharges.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                                    Recurring in this category
                                  </p>
                                  <ul className="mt-3 space-y-2">
                                    {matchingCharges.map((charge) => {
                                      const chargeAccount = formatRecurringAccountSource(charge)

                                      return (
                                        <li
                                          key={`${entry.category}-${charge.merchant}-${charge.lastChargedDate}`}
                                          className="rounded-lg border border-[#1E2D45] bg-[#111827] px-3 py-3"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="font-medium text-[#F9FAFB]">
                                                {charge.merchant}
                                              </p>
                                              <p className="mt-1 text-xs text-[#6B7280]">
                                                {formatCadenceLabel(charge.cadence)}
                                                {charge.source
                                                  ? ` · ${formatRecurringSourceLabel(charge.source)}`
                                                  : ''}
                                              </p>
                                              <div className="mt-1">
                                                <AccountSourceLine sources={chargeAccount} />
                                              </div>
                                            </div>
                                            <span className="shrink-0 font-mono text-sm tabular-nums text-[#D1D5DB]">
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
              )}
            </section>

            <section aria-label="Recurring charges">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                  Recurring charges
                </h2>
              </div>

              {recurringCharges.length > 0 && (
                <>
                  <div className="mt-4 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C4B5FD]">
                      Annual subscription cost
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-[#F9FAFB]">
                      {formatCurrency(totalRecurringAnnual)}/year
                    </p>
                    <p className="mt-1 text-sm text-[#D1D5DB]">
                      {formatCurrency(totalRecurringMonthly)}/mo
                      {recurringCharges.length === 1
                        ? ' · 1 confirmed subscription'
                        : ` · ${recurringCharges.length} confirmed subscriptions`}
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-sm font-semibold text-[#9CA3AF]">
                    Total recurring: {formatCurrency(totalRecurringMonthly)}/mo
                  </p>
                </>
              )}

              {recurringCharges.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
                  <p className="text-sm leading-relaxed text-[#9CA3AF]">
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
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#9CA3AF]">
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
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default ExpenseAnalyzerPage
