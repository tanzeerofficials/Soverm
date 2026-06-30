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
    label: 'AI chat with your CFO',
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
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            {label}
          </p>
          <p className="mt-1 text-sm font-medium text-[#F9FAFB]">
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
      <h2 id="pricing-heading" className="text-center text-2xl font-bold text-[#F9FAFB]">Pricing</h2>
      <p className="mt-3 text-center text-sm text-[#9CA3AF]">
        Start free. Upgrade when you want unlimited insights and full history.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-[#1E2D45] bg-[#111827] p-6">
          <h3 className="text-lg font-semibold text-[#F9FAFB]">Free</h3>
          <p className="mt-2 font-mono text-3xl font-light text-[#F9FAFB]">$0</p>
          <FeatureList tier="free" />
          <div className="mt-8">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg border border-[#1E2D45] bg-[#1A2236] px-5 py-2.5 text-sm font-semibold text-[#F9FAFB] transition hover:bg-[#232d42]"
              >
                Sign Up Free
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="relative flex flex-col rounded-xl border border-[#F59E0B] bg-[#111827] p-6 shadow-[0_0_28px_rgba(245,158,11,0.18)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F59E0B] px-3 py-1 text-xs font-semibold text-[#0A0F1C]">
            Most popular
          </span>
          <h3 className="text-lg font-semibold text-[#F9FAFB]">Soverm Pro</h3>
          <p className="mt-2 font-mono text-3xl font-light text-[#F59E0B]">
            {formatCurrency(PRO_MONTHLY_PRICE)}
            <span className="text-base font-normal text-[#9CA3AF]">/mo</span>
          </p>
          <FeatureList tier="pro" />
          <div className="mt-8">
            <button
              type="button"
              onClick={handleUpgrade}
              className="w-full rounded-lg bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#0A0F1C] transition hover:bg-[#FBBF24]"
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
