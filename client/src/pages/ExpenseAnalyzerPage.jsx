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
import StatDeltaBadge from '../components/StatDeltaBadge.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { expenseAnalyzerQueryKey } from '../lib/queryKeys.js'
import { fetchExpenseAnalyzer } from '../lib/fetchExpenseAnalyzer.js'
import {
  buildTopMoverHeadline,
  isNotableTopMover,
  topMoverHeadlineStyles,
} from '../lib/topMover.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

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
  const topMover = isNotableTopMover(data?.topMover) ? data.topMover : null
  const topMoverHeadline = topMover ? buildTopMoverHeadline(topMover) : null
  const totalRecurringMonthly = data?.totalRecurringMonthly ?? 0
  const overallSpending = data?.overallSpending ?? null
  const narrativeSummary = data?.narrativeSummary ?? null
  const overallSpendingLine = formatOverallSpendingLine(overallSpending)

  function toggleCategoryExpansion(category, recurringForCategory) {
    if (!recurringForCategory?.length) {
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
        </div>

        {isLoading ? (
          <div className="space-y-8" aria-busy="true" aria-label="Loading expense analyzer">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
            <p className="text-sm text-[#9CA3AF]">
              Couldn&apos;t load your expense breakdown. Please try again in a moment.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {narrativeSummary && (
              <section className="rounded-xl border border-[#1E2D45] bg-[#111827] p-5 sm:p-6">
                <p className="text-sm leading-relaxed text-[#D1D5DB]">{narrativeSummary}</p>
              </section>
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
                <ul className="mt-4 space-y-2">
                  {categoryBreakdown.map((entry) => {
                    const matchingCharges = entry.recurringCharges ?? []
                    const isExpandable = matchingCharges.length > 0
                    const isExpanded = expandedCategory === entry.category

                    return (
                      <li key={entry.category}>
                        <div
                          className={`rounded-lg border border-[#1E2D45] bg-[#111827] px-4 py-3 ${
                            isExpandable
                              ? 'cursor-pointer transition hover:bg-[#1A2236]'
                              : ''
                          }`}
                          role={isExpandable ? 'button' : undefined}
                          tabIndex={isExpandable ? 0 : undefined}
                          aria-expanded={isExpandable ? isExpanded : undefined}
                          onClick={() =>
                            toggleCategoryExpansion(entry.category, matchingCharges)
                          }
                          onKeyDown={(event) => {
                            if (!isExpandable) {
                              return
                            }

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleCategoryExpansion(entry.category, matchingCharges)
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-[#F9FAFB]">
                                  {entry.category}
                                </p>
                                {entry.percentOfTotal > 0 && (
                                  <span className="text-xs text-[#6B7280]">
                                    {entry.percentOfTotal}% of spend
                                  </span>
                                )}
                                {isExpandable && (
                                  <span className="text-xs text-[#8B5CF6]">
                                    {matchingCharges.length} recurring
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 font-mono text-lg font-bold text-[#F9FAFB]">
                                {formatCurrency(entry.currentTotal)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {entry.delta && (
                                <StatDeltaBadge delta={entry.delta} statType="spending" inline />
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

                        {isExpanded && matchingCharges.length > 0 && (
                          <ul className="mt-2 space-y-2 border-l-2 border-[#8B5CF6]/40 pl-4">
                            {matchingCharges.map((charge) => (
                              <li
                                key={`${entry.category}-${charge.merchant}-${charge.lastChargedDate}`}
                                className="rounded-lg bg-[#1A2236] px-3 py-2 text-sm"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-[#F9FAFB]">
                                    {charge.merchant}
                                  </span>
                                  <span className="font-mono text-[#D1D5DB]">
                                    {formatCurrency(charge.monthlyEquivalent ?? charge.averageAmount)}
                                    /mo eq.
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-[#9CA3AF]">
                                  {formatCadenceLabel(charge.cadence)} · next expected:{' '}
                                  {formatChargeDate(charge.nextExpectedDate)}
                                </p>
                              </li>
                            ))}
                          </ul>
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
                {recurringCharges.length > 0 && (
                  <p className="font-mono text-sm font-semibold text-[#F9FAFB]">
                    Total recurring: {formatCurrency(totalRecurringMonthly)}/mo
                  </p>
                )}
              </div>

              {recurringCharges.length === 0 ? (
                <div className="mt-4 rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
                  <p className="text-sm leading-relaxed text-[#9CA3AF]">
                    No recurring charges detected yet — check back after a couple months of
                    transaction history.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {recurringCharges.map((charge) => (
                    <li
                      key={`${charge.merchant}-${charge.lastChargedDate}`}
                      className="rounded-lg border border-[#1E2D45] bg-[#111827] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#F9FAFB]">{charge.merchant}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-[#8B5CF6]">
                            {formatCadenceLabel(charge.cadence)}
                            {charge.category ? ` · ${charge.category}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-lg font-bold text-[#F9FAFB]">
                            {formatCurrency(charge.averageAmount)}
                          </p>
                          <p className="mt-1 text-xs text-[#9CA3AF]">
                            {formatCurrency(charge.monthlyEquivalent ?? charge.averageAmount)}/mo
                            eq. · next: {formatChargeDate(charge.nextExpectedDate)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-[#6B7280]">
                        {charge.occurrenceCount} charges detected · last on{' '}
                        {formatChargeDate(charge.lastChargedDate)}
                        {charge.confidence ? ` · ${charge.confidence} confidence` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default ExpenseAnalyzerPage
