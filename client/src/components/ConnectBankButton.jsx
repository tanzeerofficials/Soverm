/*
 * CONNECT BANK BUTTON
 *
 * Opens Plaid Link via the shared PlaidLinkProvider context.
 * usePlaidLink lives in one place only — Plaid requires a single embed per page.
 */

import { usePlaidLinkContext } from '../context/PlaidLinkContext.jsx'
import { trackConnectBankClick } from '../lib/analytics.js'

function ConnectBankButton({ className = '', highlighted = false, showSecurityNote = true }) {
  const { open, ready, isExchanging } = usePlaidLinkContext()

  const label = isExchanging ? 'Connecting & syncing…' : 'Connect Your Bank'

  function handleClick() {
    trackConnectBankClick()
    open()
  }

  return (
    <div
      className={`flex w-full max-w-full flex-col items-center ${
        highlighted
          ? 'rounded-lg ring-2 ring-[#10B981] ring-offset-1 ring-offset-[#0A0F1C]'
          : ''
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || isExchanging}
        className={`min-h-11 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 ${
          highlighted && !isExchanging ? 'animate-pulse' : ''
        } ${className}`}
      >
        {label}
      </button>
      {showSecurityNote && (
      <p className="mt-2 flex max-w-[280px] items-center justify-center gap-1.5 px-1 text-center text-[11px] leading-snug text-[#9CA3AF] sm:text-xs">
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
        Secured by Plaid — bank-level encryption
      </p>
      )}
    </div>
  )
}

export default ConnectBankButton
