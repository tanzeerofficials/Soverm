/*
 * LANDING PAGE
 *
 * This is the public homepage for people who are NOT logged in yet.
 * If someone is already logged in, we immediately send them to /dashboard.
 */

import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import AppLoadingScreen from '../components/AppLoadingScreen.jsx'
import LandingComparison from '../components/LandingComparison.jsx'
import LandingCompoundSection from '../components/LandingCompoundSection.jsx'
import LandingInsightPreview from '../components/LandingInsightPreview.jsx'
import LandingNavbar from '../components/LandingNavbar.jsx'
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

const HERO_TRUST_CHIPS = ['Free to start', 'No credit card', 'Read-only access']

function LandingPage() {
  return (
    <>
      <SignedIn>
        <AppLoadingScreen message="Taking you to your dashboard…" />
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <LandingNavbar />
        <main className="bg-[#0A0F1C] px-6 pb-16 text-white">
          {/* Hero */}
          <div className="relative mx-auto max-w-4xl pt-16 text-center sm:pt-24">
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.14)_0%,_transparent_65%)]"
              aria-hidden="true"
            />

            <p className="relative text-sm font-medium uppercase tracking-wide text-emerald-500">
              Your Personal Accountant
            </p>
            <h1 className="relative mt-3 text-4xl font-bold leading-tight tracking-tight text-[#F9FAFB] sm:text-5xl lg:text-6xl">
              Your personal accountant tells you the truth about your money.
            </h1>
            <p className="relative mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#9CA3AF]">
              Accounting intelligence that monitors your transactions, analyzes where your
              money actually goes, and delivers financial insights — so you can make smarter
              decisions with every dollar.
            </p>
            <p className="relative mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#F9FAFB]">
              And you know what&apos;s even more interesting? It gets sharper every single day
              you use it.
            </p>

            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 sm:w-auto"
                >
                  Get started free
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-lg border border-[#1E2D45] bg-[#111827] px-8 py-3.5 text-sm font-medium text-[#F9FAFB] transition hover:border-[#2D3F5C] hover:bg-[#1A2236] sm:w-auto"
                >
                  Sign In
                </button>
              </SignInButton>
            </div>

            <ul className="relative mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {HERO_TRUST_CHIPS.map((chip) => (
                <li
                  key={chip}
                  className="flex items-center gap-1.5 text-xs text-[#6B7280]"
                >
                  <svg
                    className="h-3.5 w-3.5 text-emerald-500"
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

          <LandingInsightPreview />

          <LandingCompoundSection />

          <LandingComparison />

          {/* How it works */}
          <section
            id="how-it-works"
            className="mx-auto mt-24 max-w-4xl"
            aria-labelledby="how-it-works-heading"
          >
            <div className="text-center">
              <h2 id="how-it-works-heading" className="text-2xl font-bold text-[#F9FAFB] sm:text-3xl">
                How it works
              </h2>
              <p className="mt-3 text-sm text-[#9CA3AF]">
                Three steps from bank connection to actionable advice.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ step, title, description }) => (
                <article
                  key={step}
                  className="relative flex flex-col rounded-xl border border-[#1E2D45] bg-[#111827] p-6 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-sm font-bold text-emerald-400">
                    {step}
                  </span>
                  <h3 className="mt-4 font-semibold text-[#F9FAFB]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <SecurityTrustSection />

          <PricingSection />

          <SecurityFaq />

          {/* Final CTA */}
          <section className="mx-auto mb-8 mt-24 max-w-2xl text-center">
            <div className="rounded-2xl border border-[#1E2D45] bg-gradient-to-b from-[#111827] to-[#0A0F1C] px-6 py-12 sm:px-10">
              <h2 className="text-2xl font-bold text-[#F9FAFB] sm:text-3xl">
                Ready to know where you actually stand?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-[#9CA3AF]">
                Accounting intelligence that watches your transactions and turns them into
                clear insights — so you always know the smartest move for your money.
              </p>
              <div className="mt-8">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500 px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Get started free
                  </button>
                </SignUpButton>
              </div>
              <p className="mt-3 text-xs text-[#6B7280]">
                No credit card required · Cancel anytime
              </p>
            </div>
          </section>
        </main>
      </SignedOut>
    </>
  )
}

export default LandingPage
