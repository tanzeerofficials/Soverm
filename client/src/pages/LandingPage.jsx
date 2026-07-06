/*
 * LANDING PAGE
 *
 * This is the public homepage for people who are NOT logged in yet.
 * If someone is already logged in, we immediately send them to /dashboard.
 */

import { SignedIn, SignedOut, SignUpButton } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import AppLoadingScreen from '../components/AppLoadingScreen.jsx'
import LandingComparison from '../components/LandingComparison.jsx'
import LandingCompoundSection from '../components/LandingCompoundSection.jsx'
import LandingHero from '../components/LandingHero.jsx'
import LandingInsightPreview from '../components/LandingInsightPreview.jsx'
import LandingNavbar from '../components/LandingNavbar.jsx'
import RevealOnScroll from '../components/RevealOnScroll.jsx'
import SecurityFaq from '../components/SecurityFaq.jsx'
import SecurityTrustSection from '../components/SecurityTrustSection.jsx'
import PricingSection from '../components/PricingSection.jsx'

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Connect your bank',
    description:
      'Link through Plaid in under a minute — the same secure technology used by Venmo, Coinbase, and major banks.',
  },
  {
    step: '2',
    title: 'Soverm reads your activity',
    description:
      'Every transaction and balance is analyzed for patterns — not just what you have, but where money is actually going.',
  },
  {
    step: '3',
    title: 'Get honest, specific advice',
    description:
      'A plain-English insight with real numbers, risks, and three concrete actions you can take this week.',
  },
]

function LandingPage() {
  return (
    <>
      <SignedIn>
        <AppLoadingScreen message="Taking you to your dashboard…" />
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <LandingNavbar />
        <main className="bg-app px-6 pb-16 text-fg">
          <LandingHero />

          <LandingInsightPreview />

          <RevealOnScroll delay={80}>
            <LandingCompoundSection />
          </RevealOnScroll>

          <RevealOnScroll delay={120}>
            <LandingComparison />
          </RevealOnScroll>

          {/* How it works */}
          <RevealOnScroll delay={80}>
          <section
            id="how-it-works"
            className="mx-auto mt-24 max-w-4xl"
            aria-labelledby="how-it-works-heading"
          >
            <div className="text-center">
              <h2 id="how-it-works-heading" className="text-2xl font-bold text-fg sm:text-3xl">
                How it works
              </h2>
              <p className="mt-3 text-sm text-fg-muted">
                Three steps from bank connection to actionable advice.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ step, title, description }) => (
                <article
                  key={step}
                  className="relative flex flex-col rounded-xl border border-border-default bg-surface p-6 text-left transition hover:border-[#2D3A52] hover:bg-surface-elevated/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/40 bg-brand/10 text-sm font-bold text-brand-soft">
                    {step}
                  </span>
                  <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>
                </article>
              ))}
            </div>
          </section>
          </RevealOnScroll>

          <RevealOnScroll>
            <SecurityTrustSection />
          </RevealOnScroll>

          <RevealOnScroll delay={60}>
            <PricingSection />
          </RevealOnScroll>

          <RevealOnScroll delay={80}>
            <SecurityFaq />
          </RevealOnScroll>

          {/* Final CTA */}
          <RevealOnScroll delay={100}>
          <section className="mx-auto mb-8 mt-24 max-w-2xl text-center">
            <div className="rounded-2xl border border-border-default bg-gradient-to-b from-surface to-app px-6 py-12 sm:px-10">
              <h2 className="text-2xl font-bold text-fg sm:text-3xl">
                Ready to know where you actually stand?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
                Accounting intelligence that watches your transactions and turns them into
                clear insights — so you always know the smartest move for your money.
              </p>
              <div className="mt-8">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-brand-soft"
                  >
                    Get started free
                  </button>
                </SignUpButton>
              </div>
              <p className="mt-3 text-xs text-fg-subtle">
                No credit card required · Cancel anytime
              </p>
            </div>
          </section>
          </RevealOnScroll>
        </main>
      </SignedOut>
    </>
  )
}

export default LandingPage
