/*
 * PRO FEATURE GATE
 *
 * Compact upgrade prompt when a signed-in free user opens a Pro-only surface.
 */

import { PRO_MONTHLY_PRICE } from '@shared/usageLimits.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function ProFeatureGate({ title, description, onUpgrade }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-fg-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="shrink-0 rounded-lg bg-warning px-4 py-2.5 text-sm font-semibold text-app transition hover:brightness-110"
        >
          Upgrade — {formatCurrency(PRO_MONTHLY_PRICE)}/mo
        </button>
      </div>
    </div>
  )
}

export default ProFeatureGate
