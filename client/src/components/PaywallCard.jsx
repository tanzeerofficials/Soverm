/*
 * PAYWALL CARD
 *
 * Shown when a free-tier user hits the daily insight limit. The limit
 * is stated plainly, with a blurred preview of what a second insight
 * looks like so the value being withheld is visible rather than abstract.
 *
 * Price is anchored against the person's own spending for the period,
 * not an arbitrary "go pro!" pitch.
 */

import {
  FREE_HISTORY_DAYS,
  PRO_MONTHLY_PRICE,
} from '@shared/usageLimits.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function PaywallCard({ spent, onUpgrade }) {
  const monthlyPrice = PRO_MONTHLY_PRICE
  const hasSpendContext = typeof spent === 'number' && spent > 0
  const percentOfSpend = hasSpendContext ? (monthlyPrice / spent) * 100 : null

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default border-l-4 border-l-warning bg-surface">
      <div className="select-none p-6 opacity-60 blur-[3px]" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ai">
            Soverm Insight
          </span>
          <span className="text-xs text-fg-muted">Today</span>
        </div>
        <h3 className="mb-4 mt-4 h-7 w-3/4 rounded bg-surface-elevated text-2xl font-bold text-fg">
          &nbsp;
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-lg border border-border-default bg-app px-4 py-3">
              <div className="h-2.5 w-12 rounded bg-surface-elevated" />
              <div className="mt-2 h-5 w-16 rounded bg-surface-elevated" />
              <div className="mt-2 h-2.5 w-20 rounded bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/80 px-6 text-center backdrop-blur-[1px]">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/35 bg-warning/10"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5 text-warning"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              d="M7 11V7a5 5 0 0110 0v4M6 11h12v9H6z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="text-sm font-semibold text-fg">
          You&apos;ve used today&apos;s free insight
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-fg-muted">
          Soverm Pro gives you unlimited insights, on-demand, any time you want a fresh read on
          your money — plus your full history, not just the last {FREE_HISTORY_DAYS} days.
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-1 rounded-lg bg-warning px-5 py-2.5 text-sm font-semibold text-app transition hover:brightness-110"
        >
          Upgrade to Soverm Pro — {formatCurrency(monthlyPrice)}/mo
        </button>
        {hasSpendContext && (
          <p className="text-[11px] text-fg-subtle">
            That&apos;s less than {percentOfSpend < 1 ? '1%' : `${Math.round(percentOfSpend)}%`} of
            what you spent this period ({formatCurrency(spent)}).
          </p>
        )}
      </div>
    </div>
  )
}

export default PaywallCard
