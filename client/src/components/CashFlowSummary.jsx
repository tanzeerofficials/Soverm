/*
 * CASH FLOW SUMMARY
 *
 * Headline Money in / Money out / Net for the selected dashboard range.
 * Own-account transfers and card payments stay out of the headline and
 * appear as separate source notes when present.
 */

import { computeCashFlowMetrics } from '../lib/cashFlowSummary.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function CashFlowSummary({
  income = 0,
  spent = 0,
  rangeLabel,
  cashFlow = null,
}) {
  const moneyIn = cashFlow?.moneyIn ?? income
  const moneyOut = cashFlow?.moneyOut ?? spent
  const byKind = cashFlow?.byKind ?? null
  const internalMoved = cashFlow?.internalMoved ?? 0
  const liabilityPayments = cashFlow?.liabilityPayments ?? 0

  const { net, spendRatio, spendPercent, netIsPositive } = computeCashFlowMetrics(
    moneyIn,
    moneyOut
  )

  const sourceNotes = []
  if (byKind?.peer_in > 0) {
    sourceNotes.push(`Incl. ${formatCurrency(byKind.peer_in)} Zelle/peer received`)
  }
  if (byKind?.peer_out > 0) {
    sourceNotes.push(`${formatCurrency(byKind.peer_out)} peer sent`)
  }
  if (internalMoved > 0) {
    sourceNotes.push(`${formatCurrency(internalMoved)} moved between your accounts`)
  }
  if (liabilityPayments > 0) {
    sourceNotes.push(`${formatCurrency(liabilityPayments)} card/loan payments`)
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border-default bg-app/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Cash flow
        </p>
        <p className="text-[11px] text-fg-subtle">{rangeLabel}</p>
      </div>
      <p className="mt-1 text-[11px] text-fg-subtle">
        External cash only — own-account transfers and card payments are listed separately.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="min-w-0 rounded-lg border border-brand/20 bg-brand/5 px-2 py-2.5 text-center sm:px-4 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-soft">
            Money in
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums leading-tight text-brand-soft sm:text-xl">
            {formatCurrency(moneyIn)}
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-danger/20 bg-danger/5 px-2 py-2.5 text-center sm:px-4 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-danger/90">
            Money out
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums leading-tight text-danger sm:text-xl">
            {formatCurrency(moneyOut)}
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

      {sourceNotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-center text-[11px] text-fg-subtle">
          {sourceNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {spendRatio != null ? (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-elevated"
            role="progressbar"
            aria-valuenow={spendPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${spendPercent}% of money in spent`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-danger transition-all duration-500"
              style={{ width: `${spendPercent}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-fg-muted">
            {spendPercent}% of money in spent
            {netIsPositive
              ? ` · ${formatCurrency(net)} surplus this period`
              : ` · ${formatCurrency(Math.abs(net))} over money in`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-fg-subtle">
          No money in recorded {rangeLabel} — money out total shown above.
        </p>
      )}
    </div>
  )
}

export default CashFlowSummary
