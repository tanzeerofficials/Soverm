/*
 * LANDING HERO
 *
 * Above-the-fold landing copy with mesh background, floating orbs,
 * and entrance animation on first paint.
 */

import { SignInButton, SignUpButton } from '@clerk/clerk-react'

const HERO_TRUST_CHIPS = ['Free to start', 'No credit card', 'Read-only access']

function LandingHero() {
  return (
    <div className="landing-hero relative mx-auto max-w-4xl overflow-hidden pt-16 text-center sm:pt-24">
      <div className="landing-hero-mesh pointer-events-none absolute inset-x-0 -top-12 h-[28rem]" aria-hidden="true" />
      <div
        className="landing-hero-orb landing-hero-orb--brand pointer-events-none absolute left-[12%] top-16 h-36 w-36 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="landing-hero-orb landing-hero-orb--ai pointer-events-none absolute right-[10%] top-24 h-44 w-44 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="landing-hero-orb landing-hero-orb--center pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div className="landing-hero-stagger relative">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Your Personal Accountant</p>

        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-fg sm:text-5xl lg:text-6xl">
          Your personal accountant tells you the truth about your money.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">
          Accounting intelligence that monitors your transactions, analyzes where your money actually
          goes, and delivers financial insights — so you can make smarter decisions with every dollar.
        </p>

        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-fg">
          And you know what&apos;s even more interesting? It gets sharper every single day you use
          it.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="w-full rounded-lg bg-brand px-8 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft sm:w-auto"
            >
              Get started free
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded-lg border border-border-default bg-surface px-8 py-3.5 text-sm font-medium text-fg transition hover:border-[#2D3F5C] hover:bg-surface-elevated sm:w-auto"
            >
              Sign In
            </button>
          </SignInButton>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {HERO_TRUST_CHIPS.map((chip) => (
            <li key={chip} className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <svg className="h-3.5 w-3.5 text-brand" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {chip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default LandingHero
