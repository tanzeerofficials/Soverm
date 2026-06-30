/*
 * LANDING NAVBAR
 *
 * Minimal sticky header for the public homepage — logo, section anchors,
 * and auth buttons. Only rendered on the landing page (not in App.jsx)
 * so logged-in dashboard keeps its own AppNavbar.
 */

import { SignInButton, SignUpButton } from '@clerk/clerk-react'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#1E2D45]/80 bg-[#0A0F1C]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          href="/"
          className="text-sm font-bold tracking-wide text-[#F9FAFB] transition hover:text-emerald-400"
        >
          SOVERM
        </a>

        <nav
          className="hidden items-center gap-6 text-sm text-[#9CA3AF] md:flex"
          aria-label="Landing page sections"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="transition hover:text-[#F9FAFB]"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#9CA3AF] transition hover:text-[#F9FAFB]"
            >
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
    </header>
  )
}

export default LandingNavbar
