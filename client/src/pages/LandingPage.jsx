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
import LandingHowItWorks from '../components/LandingHowItWorks.jsx'
import LandingInsightPreview from '../components/LandingInsightPreview.jsx'
import LandingNavbar from '../components/LandingNavbar.jsx'
import RevealOnScroll from '../components/RevealOnScroll.jsx'
import SecurityFaq from '../components/SecurityFaq.jsx'
import SecurityTrustSection from '../components/SecurityTrustSection.jsx'
import PricingSection from '../components/PricingSection.jsx'

function LandingPage() {
  return (
    <>
      <SignedIn>
        <AppLoadingScreen message="Taking you to your dashboard…" />
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <LandingNavbar />
        <main className="bg-app pb-16 text-fg">
          <LandingHero />

          <div className="px-6">
          <LandingInsightPreview />

          <RevealOnScroll delay={80}>
            <LandingCompoundSection />
          </RevealOnScroll>

          <RevealOnScroll delay={120}>
            <LandingComparison />
          </RevealOnScroll>

          {/* How it works */}
          <RevealOnScroll delay={80}>
            <div className="mt-24">
              <LandingHowItWorks />
            </div>
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
                Ready to know what&apos;s left this week?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
                Connect a bank, confirm payday, and get your first weekly check-in — free.
              </p>
              <div className="mt-8">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-brand-soft"
                  >
                    Start free
                  </button>
                </SignUpButton>
              </div>
              <p className="mt-3 text-xs text-fg-subtle">
                No credit card required · Cancel anytime
              </p>
            </div>
          </section>
          </RevealOnScroll>
          </div>
        </main>
      </SignedOut>
    </>
  )
}

export default LandingPage
