/*
 * PRICING SECTION (G4)
 *
 * Free tier delivers the weekly loop; Pro gates depth (insights volume, history).
 */

import { SignUpButton, useAuth } from '@clerk/clerk-react'
import { useState } from 'react'
import {
  CHAT_HOURLY_LIMIT,
  FREE_DAILY_CHAT_LIMIT,
  FREE_DAILY_INSIGHT_LIMIT,
  FREE_HISTORY_DAYS,
  PRO_MONTHLY_PRICE,
} from '@shared/usageLimits.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { trackUpgradeProClick } from '../lib/analytics.js'
import {
  checkoutErrorToastMessage,
  startProCheckout,
} from '../lib/startProCheckout.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const FEATURE_ROWS = [
  {
    label: 'Your week + what’s left until payday',
    free: 'Included',
    pro: 'Included',
  },
  {
    label: 'Month-end accountant letter',
    free: 'Included',
    pro: 'Included',
  },
  {
    label: '“Can I afford it?” check',
    free: 'Included',
    pro: 'Included',
  },
  {
    label: 'Spending tracker',
    free: '1 spending cap',
    pro: 'Custom alerts',
  },
  {
    label: 'Savings goals',
    free: '—',
    pro: 'Up to 5 goals',
  },
  {
    label: 'Ask Soverm chat',
    free: `${FREE_DAILY_CHAT_LIMIT} messages/day`,
    pro: `${CHAT_HOURLY_LIMIT}/hour`,
  },
  {
    label: 'AI insights per day',
    free: String(FREE_DAILY_INSIGHT_LIMIT),
    pro: 'Unlimited',
  },
  {
    label: 'Insight history',
    free: `Last ${FREE_HISTORY_DAYS} days`,
    pro: 'Full history',
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
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
          <p className="mt-1 text-sm font-medium text-fg">{tier === 'free' ? free : pro}</p>
        </li>
      ))}
    </ul>
  )
}

function PricingSection() {
  const { getToken, isSignedIn } = useAuth()
  const { showToast } = useToastContext()
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  async function handleUpgrade() {
    trackUpgradeProClick('pricing')

    if (!isSignedIn) {
      showToast('Create a free account first, then upgrade to Pro', 'success')
      return
    }

    setCheckoutLoading(true)
    try {
      await startProCheckout(getToken)
    } catch (err) {
      showToast(checkoutErrorToastMessage(err), 'error')
      setCheckoutLoading(false)
    }
  }

  return (
    <section className="mx-auto mt-24 max-w-4xl" id="pricing" aria-labelledby="pricing-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Pricing</p>
        <h2 id="pricing-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Free tells you where you stand. Pro helps you stay on track.
        </h2>
        <p className="mt-3 text-sm text-fg-muted">
          Free includes the weekly loop — your week, what&apos;s left, the month letter, afford
          checks, and one spending cap. Pro adds savings goals, custom alerts, unlimited insights,
          and full history.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative flex flex-col rounded-xl border border-brand/40 bg-brand/5 p-6 shadow-[0_0_32px_rgba(16,185,129,0.08)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-fg">
            Start here
          </span>
          <h3 className="text-lg font-semibold text-fg">Free</h3>
          <p className="mt-2 font-mono text-3xl font-light text-fg">$0</p>
          <p className="mt-2 text-sm text-fg-muted">
            Weekly check-in, what&apos;s left, month letter, afford checks, and one spending cap —
            no card required.
          </p>
          <FeatureList tier="free" />
          <div className="mt-8">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft"
              >
                Start free
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-border-default bg-surface p-6 transition hover:border-border-hover hover:bg-surface-elevated/30">
          <h3 className="text-lg font-semibold text-fg">Soverm Pro</h3>
          <p className="mt-2 font-mono text-3xl font-light text-brand-soft">
            {formatCurrency(PRO_MONTHLY_PRICE)}
            <span className="text-base font-normal text-fg-muted">/mo</span>
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Savings goals, custom alerts, unlimited AI insights, and full history when you want more
            depth.
          </p>
          <FeatureList tier="pro" />
          <div className="mt-8">
            {isSignedIn ? (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full rounded-lg border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-fg transition hover:border-border-hover disabled:opacity-60"
              >
                {checkoutLoading ? 'Redirecting…' : 'Upgrade to Pro'}
              </button>
            ) : (
              <SignUpButton mode="modal">
                <button
                  type="button"
                  onClick={() => trackUpgradeProClick('pricing')}
                  className="w-full rounded-lg border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-fg transition hover:border-border-hover"
                >
                  Upgrade to Pro
                </button>
              </SignUpButton>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default PricingSection
