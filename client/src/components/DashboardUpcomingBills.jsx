/*
 * DASHBOARD UPCOMING BILLS
 *
 * Tools teaser for confirmed recurring charges due in the next 14 days.
 * Data comes from the same cash-flow forecast scheduledOutflows list.
 */

import { Link } from 'react-router-dom'
import Skeleton from './Skeleton.jsx'
import {
  BILL_CALENDAR_TEASER_DAYS,
  buildBillCalendarDays,
  summarizeBillCalendar,
} from '../lib/billCalendar.js'
import { formatForecastDate } from '../lib/cashFlowForecast.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0)
}

function DashboardUpcomingBills({
  forecast,
  isLoading,
  onOpenForecast,
}) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-16 w-full" />
      </section>
    )
  }

  const days = buildBillCalendarDays(forecast?.scheduledOutflows ?? [], {
    withinDays: BILL_CALENDAR_TEASER_DAYS,
  })
  const summary = summarizeBillCalendar(days)

  if (summary.billCount === 0) {
    return (
      <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fg-subtle">
          Upcoming bills
        </p>
        <p className="mt-3 text-sm text-fg-muted">
          No confirmed recurring charges due in the next {BILL_CALENDAR_TEASER_DAYS} days.
        </p>
        <Link
          to="/expense-analyzer?tab=recurring"
          className="mt-3 inline-flex text-sm font-medium text-ai-soft hover:underline"
        >
          Review subscriptions →
        </Link>
      </section>
    )
  }

  const previewDays = days.slice(0, 3)

  return (
    <section className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fg-subtle">
            Upcoming bills
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Next {BILL_CALENDAR_TEASER_DAYS} days · {summary.billCount} charge
            {summary.billCount === 1 ? '' : 's'} · {formatCurrency(summary.totalAmount)}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenForecast}
          className="text-xs font-semibold text-ai-soft transition hover:text-ai hover:underline"
        >
          Full forecast →
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {previewDays.map((day) => (
          <li key={day.date} className="rounded-lg border border-border-default bg-app/40 px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                {day.relativeLabel}
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-fg">
                {formatCurrency(day.total)}
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {day.events.slice(0, 3).map((event, index) => (
                <li
                  key={`${event.merchant}-${event.amount}-${index}`}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span className="truncate text-fg">{event.merchant}</span>
                  <span className="shrink-0 font-mono tabular-nums text-fg-muted">
                    {formatCurrency(event.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {day.events.length > 3 ? (
              <p className="mt-1 text-xs text-fg-subtle">
                +{day.events.length - 3} more on {formatForecastDate(day.date)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DashboardUpcomingBills
