import { formatDistanceToNow } from 'date-fns'
import { useMemo } from 'react'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js'
import { fillSpendingSeries } from '../lib/spendingSparkline.js'
import CashFlowSummary from './CashFlowSummary.jsx'
import SpendingSparkline from './SpendingSparkline.jsx'

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

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function DashboardHero({
  hasAccounts,
  totalBalance = 0,
  lastSyncedAt,
  selectedRange,
  onRangeChange,
  income = 0,
  spent = 0,
  spendingSeries = [],
}) {
  const animatedBalance = useAnimatedNumber(totalBalance)
  const filledSpendingSeries = useMemo(
    () => fillSpendingSeries(spendingSeries, selectedRange),
    [spendingSeries, selectedRange]
  )

  if (!hasAccounts) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-[#131B2E]/90 via-surface to-app px-6 py-10 text-center sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_65%)]" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-400">Step 1</p>
          <h2 className="mt-3 text-2xl font-bold text-fg sm:text-3xl">
            Connect your bank to get started
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-muted">
            Soverm needs your accounts linked before it can analyze your finances. Your bank login
            stays with Plaid — we never see it.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-[#131B2E]/90 via-surface to-app px-6 py-10 text-center shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ai/10 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fg-muted">
          Total balance
        </p>

        <p className="mt-4 font-mono text-4xl font-light tabular-nums tracking-tight text-fg sm:text-6xl md:text-7xl">
          {formatCurrency(animatedBalance)}
        </p>

        {lastSyncedAt && (
          <>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fg-muted">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Last synced {formatDistanceToNow(new Date(lastSyncedAt))} ago
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              Recent transactions may take a few minutes to appear
            </p>
          </>
        )}

        <div className="mt-6 inline-flex rounded-full border border-border-default bg-app/50 p-1">
          {RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onRangeChange(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedRange === value
                  ? 'bg-brand text-slate-950 shadow-sm'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-sm">
          <SpendingSparkline series={filledSpendingSeries} />
        </div>

        <CashFlowSummary
          income={income}
          spent={spent}
          rangeLabel={RANGE_LABELS[selectedRange]}
        />
      </div>
    </section>
  )
}

export default DashboardHero
