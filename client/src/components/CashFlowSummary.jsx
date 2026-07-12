/*
 * CASH FLOW SUMMARY
 *
 * Shows income, spending, and net for the selected dashboard range —
 * with a visual bar for how much of income was spent.
 */

import { computeCashFlowMetrics } from '../lib/cashFlowSummary.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function CashFlowSummary({ income = 0, spent = 0, rangeLabel }) {
  const { net, spendRatio, spendPercent, netIsPositive } = computeCashFlowMetrics(
    income,
    spent
  )

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border-default bg-app/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Cash flow
        </p>
        <p className="text-[11px] text-fg-subtle">{rangeLabel}</p>
      </div>
      <p className="mt-1 text-[11px] text-fg-subtle">
        Real income and spending only — transfers and credit card payments are excluded.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="min-w-0 rounded-lg border border-brand/20 bg-brand/5 px-2 py-2.5 text-center sm:px-4 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-soft">
            Income
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums leading-tight text-brand-soft sm:text-xl">
            {formatCurrency(income)}
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-danger/20 bg-danger/5 px-2 py-2.5 text-center sm:px-4 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-danger/90">
            Spend
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums leading-tight text-danger sm:text-xl">
            {formatCurrency(spent)}
          </p>
        </div>

        <div
          className={`min-w-0 rounded-lg border px-2 py-2.5 text-center sm:px-4 sm:py-3 ${
            netIsPositive
              ? 'border-brand/25 bg-brand/5'
              : 'border-danger/25 bg-danger/5'
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Net
          </p>
          <p
            className={`mt-1 font-mono text-sm font-semibold tabular-nums leading-tight sm:text-xl ${
              netIsPositive ? 'text-brand-soft' : 'text-danger'
            }`}
          >
            {netIsPositive ? '+' : '−'}
            {formatCurrency(Math.abs(net))}
          </p>
        </div>
      </div>

      {spendRatio != null ? (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-elevated"
            role="progressbar"
            aria-valuenow={spendPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${spendPercent}% of income spent`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-danger transition-all duration-500"
              style={{ width: `${spendPercent}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-fg-muted">
            {spendPercent}% of income spent
            {netIsPositive
              ? ` · ${formatCurrency(net)} surplus this period`
              : ` · ${formatCurrency(Math.abs(net))} over income`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-fg-subtle">
          No income recorded {rangeLabel} — spending total shown above.
        </p>
      )}
    </div>
  )
}

export default CashFlowSummary
