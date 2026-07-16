/*
 * CASH FLOW SUMMARY
 *
 * Headline Money in / Money out / Net for the selected dashboard range.
 * Breakdown lists every money kind specifically (Self deposit, Cash out,
 * Self transfer, peer rails, etc.) so nothing hides under a vague label.
 */

import { computeCashFlowMetrics } from '../lib/cashFlowSummary.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/** Ordered breakdown rows — only shown when the amount is > 0. */
const BREAKDOWN_ROWS = [
  { key: 'self_deposit', label: 'Self deposit', tone: 'in' },
  { key: 'income', label: 'Income / paycheck', tone: 'in' },
  { key: 'peer_in', label: 'Peer received (Zelle, Venmo, …)', tone: 'in' },
  { key: 'spend', label: 'Spending', tone: 'out' },
  { key: 'peer_out', label: 'Peer sent', tone: 'out' },
  { key: 'cash_out', label: 'Cash out (ATM)', tone: 'out' },
  { key: 'self_transfer', label: 'Self transfer', tone: 'moved' },
  { key: 'liability_payment', label: 'Card / loan payments', tone: 'moved' },
]

function CashFlowSummary({
  income = 0,
  spent = 0,
  rangeLabel,
  cashFlow = null,
}) {
  const moneyIn = cashFlow?.moneyIn ?? income
  const moneyOut = cashFlow?.moneyOut ?? spent
  const byKind = cashFlow?.byKind ?? null

  const { net, spendRatio, spendPercent, netIsPositive } = computeCashFlowMetrics(
    moneyIn,
    moneyOut
  )

  const breakdown = BREAKDOWN_ROWS.map((row) => {
    let amount = byKind?.[row.key] ?? 0
    // Back-compat: older payloads used internalMoved instead of byKind.self_transfer
    if (row.key === 'self_transfer' && amount === 0) {
      amount = cashFlow?.selfTransfers ?? cashFlow?.internalMoved ?? 0
    }
    if (row.key === 'liability_payment' && amount === 0) {
      amount = cashFlow?.liabilityPayments ?? 0
    }
    return { ...row, amount }
  }).filter((row) => row.amount > 0)

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-xl border border-border-default bg-app/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-muted">
          Cash flow
        </p>
        <p className="text-[11px] text-fg-subtle">{rangeLabel}</p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
        Every dollar labeled specifically {rangeLabel}. Money in / out / Net are external cash only —
        Self transfers and card payments are listed below so your balance change still makes sense.
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
            Net this period
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

      {breakdown.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border-default/70 pt-3 text-left text-[11px] text-fg-muted">
          {breakdown.map((row) => (
            <li
              key={row.key}
              className={`flex justify-between gap-3 ${
                row.tone === 'moved' ? 'text-fg-subtle' : ''
              }`}
            >
              <span>{row.label}</span>
              <span className="font-mono tabular-nums">{formatCurrency(row.amount)}</span>
            </li>
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
