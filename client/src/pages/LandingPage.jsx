/*
 * LANDING PAGE
 *
 * This is the public homepage for people who are NOT logged in yet.
 * If someone is already logged in, we immediately send them to /dashboard.
 */

import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import AppLoadingScreen from '../components/AppLoadingScreen.jsx'

/*
 * LandingPage
 *
 * What it does:
 * - Shows sign in / sign up buttons for logged-out users
 * - Redirects logged-in users to dashboard
 *
 * Why we need SignedIn and SignedOut:
 * - Clerk gives us easy switches so we do not manually check login state everywhere.
 *
 * Important concept:
 * - Navigate is like telling the browser "go to this page now".
 */
function LandingPage() {
  return (
    <>
      <SignedIn>
        <AppLoadingScreen message="Taking you to your dashboard…" />
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <main className="min-h-screen bg-[#0A0F1C] px-6 pb-24 text-white">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center pt-24 text-center sm:pt-32">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-500">
              SOVERM
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-[#F9FAFB] sm:text-5xl">
              Your AI CFO tells you the truth about your money.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#9CA3AF]">
              Connect your bank. Soverm reads every transaction and tells you — in plain
              English — what&apos;s working, what&apos;s not, and what to do next.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 sm:w-auto"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </div>

          <section className="mx-auto mt-24 max-w-4xl text-center">
            <h2 className="mb-12 text-2xl font-bold text-[#F9FAFB]">How it works</h2>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500 text-emerald-500">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-[#F9FAFB]">Connect your bank</h3>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  Securely link your accounts through Plaid — the same secure technology trusted and used
                  by major banks and financial apps like Venmo and Coinbase.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500 text-emerald-500">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-[#F9FAFB]">Soverm reads your activity</h3>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  Every transaction is analyzed to understand your real financial picture
                  — not just balances, but patterns.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500 text-emerald-500">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-[#F9FAFB]">Get honest, specific advice</h3>
                <p className="mt-2 text-sm text-[#9CA3AF]">
                  No charts to interpret. Soverm tells you plainly what matters and gives
                  you concrete next steps.
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto mt-24 max-w-2xl rounded-xl border border-[#1E2D45] bg-[#111827] p-8 text-center">
            <span className="text-xl text-emerald-500" aria-hidden="true">
              🛡️
            </span>
            <h2 className="mt-3 text-lg font-semibold text-[#F9FAFB]">
              Built with real security, not just promises
            </h2>

            <ul className="mt-6 flex flex-col gap-6 text-sm text-[#9CA3AF] sm:flex-row sm:justify-center">
              <li>🔒 Secured by Plaid — bank-level encryption</li>
              <li>🚫 We never have access to your credentials</li>
              <li>✕ Disconnect anytime, instantly</li>
            </ul>

            <p className="mt-4 text-xs text-[#6B7280] ">
              Soverm only receives and monitors your account balances and transaction history — never
              your login credentials.
            </p>
          </section>

          <section className="mb-16 mt-24 text-center">
            <h2 className="text-2xl font-bold text-[#F9FAFB]">
              Ready to know where you actually stand?
            </h2>
            <div className="mt-6">
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-500 px-8 py-4 text-base font-medium text-slate-950 transition hover:bg-emerald-400"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
            <p className="mt-3 text-xs text-[#6B7280]">
              Free to start. No credit card required.
            </p>
          </section>
        </main>
      </SignedOut>
    </>
  )
}

export default LandingPage
