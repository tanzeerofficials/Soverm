/*
 * LANDING NAVBAR
 *
 * Minimal sticky header for the public homepage — logo, section anchors,
 * and auth buttons. Only rendered on the landing page (not in App.jsx)
 * so logged-in dashboard keeps its own AppNavbar.
 */

import { SignInButton, SignUpButton } from '@clerk/clerk-react'
import BrandMark from './BrandMark.jsx'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function LandingNavbar() {
  return (
    <header className="relative sticky top-0 z-50 border-b border-[#1E2D45]/70 bg-[#0A0F1C]/88 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandMark to="/" />

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
