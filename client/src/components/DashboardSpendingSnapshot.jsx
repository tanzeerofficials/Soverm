/*
 * DASHBOARD SPENDING SNAPSHOT
 *
 * Compact Overview card — top category mover, recurring charges preview,
 * and links into the Expense Analyzer.
 */

import { Link } from 'react-router-dom'
import {
  buildTopMoverHeadline,
  isNotableTopMover,
  topMoverHeadlineStyles,
} from '../lib/topMover.js'
import Skeleton from './Skeleton.jsx'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function DashboardSpendingSnapshot({ summary, isLoading }) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-16 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </section>
    )
  }

  const topMover = summary?.topMover
  const notableTopMover = isNotableTopMover(topMover) ? topMover : null
  const recurringCount = summary?.recurringCount ?? 0
  const recurringPreview = summary?.recurringPreview ?? []
  const hasRecurring = recurringCount > 0
  const hasContent = notableTopMover || hasRecurring

  if (!hasContent) {
    return (
      <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ai-soft">
          Spending snapshot
        </p>
        <p className="mt-3 text-sm text-fg-muted">
          Sync your transactions and check back — category trends and subscriptions will show up
          here.
        </p>
        <Link
          to="/expense-analyzer"
          className="mt-4 inline-flex text-sm font-medium text-ai-soft transition hover:text-ai hover:underline"
        >
          Open Expense Analyzer →
        </Link>
      </section>
    )
  }

  const moverHeadline = notableTopMover ? buildTopMoverHeadline(notableTopMover) : null
  const moverStyles = notableTopMover
    ? topMoverHeadlineStyles(notableTopMover.direction)
    : null

  return (
    <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ai-soft">
            Spending snapshot
          </p>
          <p className="mt-1 text-xs text-fg-muted">Last 30 days vs the prior 30 days</p>
        </div>
        <Link
          to="/expense-analyzer"
          className="text-xs font-semibold text-ai-soft transition hover:text-ai hover:underline"
        >
          Full analyzer →
        </Link>
      </div>

      {moverHeadline && (
        <div className="mt-4 rounded-lg border border-border-default bg-app/50 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Top category change
          </p>
          <p className={`mt-1 text-sm font-medium leading-snug ${moverStyles.color}`}>
            {moverHeadline}
          </p>
        </div>
      )}

      {hasRecurring && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Recurring charges
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-fg">
              {formatCurrency(summary.totalRecurringMonthly ?? 0)}
              <span className="text-xs font-normal text-fg-muted">/mo est.</span>
            </p>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            {recurringCount} subscription{recurringCount === 1 ? '' : 's'} detected
          </p>
          {recurringPreview.length > 0 && (
            <ul className="mt-3 space-y-2">
              {recurringPreview.map((item) => (
                <li
                  key={`${item.merchant}-${item.accountLabel ?? 'unknown'}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-fg">
                    {item.merchant}
                    {item.accountLabel ? (
                      <span className="text-fg-subtle"> · {item.accountLabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-fg-muted">
                    {formatCurrency(item.monthlyEquivalent)}/mo
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

export default DashboardSpendingSnapshot
