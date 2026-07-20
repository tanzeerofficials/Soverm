/*
 * LANDING NAVBAR
 *
 * Minimal sticky header for the public homepage — logo, section anchors,
 * and auth buttons. Only rendered on the landing page (not in App.jsx)
 * so logged-in dashboard keeps its own AppNavbar.
 */

import { SignInButton, SignUpButton } from '@clerk/clerk-react'
import { useState } from 'react'
import BrandMark from './BrandMark.jsx'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function LandingNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="relative sticky top-0 z-50 border-b border-border-default/70 bg-app/88 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <BrandMark to="/" />

        <nav
          className="hidden items-center gap-6 text-sm text-fg-muted md:flex"
          aria-label="Landing page sections"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="landing-mobile-navigation"
            aria-label={`${isMobileMenuOpen ? 'Close' : 'Open'} navigation menu`}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:hidden"
          >
            {isMobileMenuOpen ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-lg px-2 py-2 text-sm font-medium text-fg-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:px-3"
            >
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:px-4"
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
      {isMobileMenuOpen && (
        <nav
          id="landing-mobile-navigation"
          className="border-t border-border-default/70 px-4 py-3 md:hidden"
          aria-label="Mobile landing page sections"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

export default LandingNavbar
