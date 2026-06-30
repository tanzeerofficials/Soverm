/*
 * FOOTER
 *
 * Shared site footer on every page (rendered in App.jsx below routes).
 * Multi-column layout: brand, product links, legal, and Plaid security badge.
 */

import { SignedIn, SignedOut, SignUpButton } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'

const PRODUCT_LINKS_PUBLIC = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#security', label: 'Security' },
  { to: '/#pricing', label: 'Pricing' },
  { to: '/#faq', label: 'FAQ' },
]

const PRODUCT_LINKS_APP = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
]

function FooterLink({ to, children }) {
  const location = useLocation()
  const isHashLink = to.startsWith('/#')
  const onHome = location.pathname === '/'

  if (isHashLink && onHome) {
    return (
      <a
        href={to.replace('/', '')}
        className="text-sm text-[#9CA3AF] transition hover:text-[#F9FAFB]"
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      to={to}
      className="text-sm text-[#9CA3AF] transition hover:text-[#F9FAFB]"
    >
      {children}
    </Link>
  )
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
        {title}
      </p>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  )
}

function PlaidBadge() {
  return (
    <div className="rounded-xl border border-[#1E2D45] bg-[#111827] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <svg
            className="h-4 w-4 text-emerald-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-[#F9FAFB]">Bank-level security</p>
          <p className="mt-1 text-xs leading-relaxed text-[#9CA3AF]">
            Read-only connections via Plaid. We never see your bank login.
          </p>
          <a
            href="https://plaid.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 transition hover:bg-[#F9FAFB]"
            aria-label="Plaid (opens in new tab)"
          >
            <img
              src="/plaid-logo.svg"
              alt="Plaid"
              className="h-3.5 w-auto"
              width={37}
              height={14}
            />
          </a>
        </div>
      </div>
    </div>
  )
}

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-[#1E2D45] bg-[#0A0F1C]">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link
              to="/"
              className="text-base font-bold tracking-wide text-[#F9FAFB] transition hover:text-emerald-400"
            >
              SOVERM
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#9CA3AF]">
              Your AI CFO — honest financial insights and specific next steps, in plain
              English.
            </p>
            <SignedOut>
              <div className="mt-5">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Get started free
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
          </div>

          {/* Product */}
          <div className="sm:col-span-1 lg:col-span-2">
            <FooterColumn title="Product">
              <SignedIn>
                {PRODUCT_LINKS_APP.map(({ to, label }) => (
                  <li key={to}>
                    <FooterLink to={to}>{label}</FooterLink>
                  </li>
                ))}
              </SignedIn>
              <SignedOut>
                {PRODUCT_LINKS_PUBLIC.map(({ to, label }) => (
                  <li key={to}>
                    <FooterLink to={to}>{label}</FooterLink>
                  </li>
                ))}
              </SignedOut>
            </FooterColumn>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2">
            <FooterColumn title="Legal">
              <li>
                <FooterLink to="/privacy">Privacy Policy</FooterLink>
              </li>
              <li>
                <FooterLink to="/terms">Terms of Service</FooterLink>
              </li>
            </FooterColumn>
          </div>

          {/* Security */}
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Security
            </p>
            <div className="mt-4">
              <PlaidBadge />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#1E2D45] pt-8 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-[#6B7280]">
            © {year} Soverm. All rights reserved.
          </p>
          <p className="text-xs text-[#6B7280]">
            Read-only access · Encrypted in transit · Disconnect anytime
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
