/*
 * FOOTER
 *
 * Shared site footer shown on every page. Sits outside page scroll areas
 * (rendered in App.jsx below the route outlet) so it always anchors to
 * the true bottom of the document.
 */

import { Link } from 'react-router-dom'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[#1E2D45] bg-[#0A0F1C]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:gap-4 md:text-left">
          <p className="text-xs text-[#9CA3AF]">© {year} Soverm</p>

          <nav
            className="flex items-center gap-4 text-xs text-[#9CA3AF] md:order-none"
            aria-label="Legal"
          >
            <Link to="/privacy" className="transition hover:text-[#F9FAFB]">
              Privacy Policy
            </Link>
            <span className="text-[#1E2D45]" aria-hidden="true">
              |
            </span>
            <Link to="/terms" className="transition hover:text-[#F9FAFB]">
              Terms of Service
            </Link>
          </nav>

          <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280] md:justify-end">
            <span>Bank-level security, powered by</span>
            {/*
              Official Plaid wordmark from plaid.com/assets/img/navbar/logo.svg.
              Black logo on a white chip per Plaid brand guidance for dark UIs.
            */}
            <a
              href="https://plaid.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded bg-white px-2 py-0.5"
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
    </footer>
  )
}

export default Footer
