/*
 * PRICING SECTION
 *
 * Landing-page Free vs Soverm Pro comparison. Limit numbers come from
 * shared/usageLimits.js — the same constants the API enforces.
 */

import { SignUpButton } from '@clerk/clerk-react'
import {
  FREE_DAILY_INSIGHT_LIMIT,
  FREE_HISTORY_DAYS,
  PRO_MONTHLY_PRICE,
} from '@shared/usageLimits.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { trackUpgradeProClick } from '../lib/analytics.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

const FEATURE_ROWS = [
  {
    label: 'Insights per day',
    free: String(FREE_DAILY_INSIGHT_LIMIT),
    pro: 'Unlimited',
  },
  {
    label: 'History',
    free: `Last ${FREE_HISTORY_DAYS} days`,
    pro: 'Full history',
  },
  {
    label: 'Chat with your accountant',
    free: 'Included',
    pro: 'Included',
  },
  {
    label: 'Price',
    free: 'Free',
    pro: `${formatCurrency(PRO_MONTHLY_PRICE)}/mo`,
  },
]

function FeatureList({ tier }) {
  return (
    <ul className="mt-6 space-y-4">
      {FEATURE_ROWS.map(({ label, free, pro }) => (
        <li key={label}>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            {label}
          </p>
          <p className="mt-1 text-sm font-medium text-fg">
            {tier === 'free' ? free : pro}
          </p>
        </li>
      ))}
    </ul>
  )
}

function PricingSection() {
  const { showToast } = useToastContext()

  function handleUpgrade() {
    trackUpgradeProClick('pricing')
    showToast('Soverm Pro checkout is coming soon — stay tuned!', 'success')
  }

  return (
    <section className="mx-auto mt-24 max-w-4xl" id="pricing" aria-labelledby="pricing-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Pricing</p>
        <h2 id="pricing-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Simple plans, no surprises
        </h2>
        <p className="mt-3 text-sm text-fg-muted">
          Start free. Upgrade when you want unlimited insights and full history.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border-default bg-surface p-6 transition hover:border-border-hover hover:bg-surface-elevated/30">
          <h3 className="text-lg font-semibold text-fg">Free</h3>
          <p className="mt-2 font-mono text-3xl font-light text-fg">$0</p>
          <FeatureList tier="free" />
          <div className="mt-8">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-fg transition hover:border-border-hover hover:brightness-110"
              >
                Sign Up Free
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="relative flex flex-col rounded-xl border border-brand/40 bg-brand/5 p-6 shadow-[0_0_32px_rgba(16,185,129,0.08)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-slate-950">
            Most popular
          </span>
          <h3 className="text-lg font-semibold text-fg">Soverm Pro</h3>
          <p className="mt-2 font-mono text-3xl font-light text-brand-soft">
            {formatCurrency(PRO_MONTHLY_PRICE)}
            <span className="text-base font-normal text-fg-muted">/mo</span>
          </p>
          <FeatureList tier="pro" />
          <div className="mt-8">
            <button
              type="button"
              onClick={handleUpgrade}
              className="w-full rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft"
            >
              Upgrade to Soverm Pro
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PricingSection
