/*
 * LANDING HERO
 *
 * Brand-first ICP pitch: weekly check-in + make it to payday.
 */

import { SignInButton, SignUpButton } from '@clerk/clerk-react'

const HERO_TRUST_CHIPS = ['Free weekly loop', 'Read-only Plaid', 'No credit card']

function LandingHero() {
  return (
    <section className="landing-hero-shell relative overflow-hidden pb-16 sm:pb-20">
      <div className="landing-hero-mesh pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="landing-hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="landing-hero-orb landing-hero-orb--brand pointer-events-none absolute left-[8%] top-20 h-44 w-44 rounded-full blur-3xl sm:left-[14%]"
        aria-hidden="true"
      />
      <div
        className="landing-hero-orb landing-hero-orb--ai pointer-events-none absolute right-[6%] top-28 h-52 w-52 rounded-full blur-3xl sm:right-[12%]"
        aria-hidden="true"
      />
      <div
        className="landing-hero-orb landing-hero-orb--center pointer-events-none absolute left-1/2 top-12 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-app"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl px-6 pt-16 text-center sm:pt-24">
        <div className="landing-hero-stagger">
          <p className="text-4xl font-bold tracking-[0.12em] text-fg sm:text-5xl sm:tracking-[0.18em] lg:text-6xl">
            SOVERM
          </p>

          <h1 className="mt-5 text-2xl font-semibold leading-snug tracking-tight text-fg sm:text-3xl lg:text-4xl">
            Track your cash flow. Get clear insights. Stay ahead — and save.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            See what&apos;s coming in and going out, so you never scramble to payday — and keep
            something left for yourself.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg bg-brand px-8 py-3.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft sm:w-auto"
              >
                Start free
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg border border-border-default bg-surface/80 px-8 py-3.5 text-sm font-medium text-fg backdrop-blur-sm transition hover:border-border-hover hover:bg-surface-elevated sm:w-auto"
              >
                Sign In
              </button>
            </SignInButton>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {HERO_TRUST_CHIPS.map((chip) => (
              <li key={chip} className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <svg
                  className="h-3.5 w-3.5 text-brand"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
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
    </section>
  )
}

export default LandingHero
