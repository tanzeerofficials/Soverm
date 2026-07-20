/*
 * FREE VS PRO PLAN CALLOUT
 *
 * Compact Home reminder so free users see what Free includes vs what Pro unlocks.
 */

import {
  CHAT_HOURLY_LIMIT,
  FREE_DAILY_CHAT_LIMIT,
  FREE_DAILY_INSIGHT_LIMIT,
  FREE_HISTORY_DAYS,
  PRO_MONTHLY_PRICE,
} from '@shared/usageLimits.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function FreeVsProPlanCallout({ onUpgrade }) {
  return (
    <section
      aria-labelledby="free-vs-pro-heading"
      className="rounded-xl border border-border-default bg-surface p-4 sm:p-5 card-shadow"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fg-subtle">Your plan</p>
      <h2 id="free-vs-pro-heading" className="mt-1 text-base font-semibold text-fg">
        Free tells you where you stand. Pro helps you stay on track.
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        You’re on Free — the weekly loop stays open. Pro adds depth when you want more.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-brand/25 bg-brand/5 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft">Free includes</p>
          <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
            <li>Your week + what’s left until payday</li>
            <li>Month-end letter + “Can I afford it?”</li>
            <li>1 spending cap · {FREE_DAILY_CHAT_LIMIT} chats/day</li>
            <li>
              {FREE_DAILY_INSIGHT_LIMIT} insight/day · {FREE_HISTORY_DAYS}-day history
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Pro unlocks</p>
          <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
            <li>Savings goals + custom spending alerts</li>
            <li>Unlimited insights + full history</li>
            <li>More Ask Soverm ({CHAT_HOURLY_LIMIT}/hour)</li>
            <li>{formatCurrency(PRO_MONTHLY_PRICE)}/mo</li>
          </ul>
        </div>
      </div>

      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 rounded-lg bg-warning px-4 py-2.5 text-sm font-semibold text-app transition hover:brightness-110"
        >
          Upgrade to Soverm Pro — {formatCurrency(PRO_MONTHLY_PRICE)}/mo
        </button>
      )}
    </section>
  )
}

export default FreeVsProPlanCallout
