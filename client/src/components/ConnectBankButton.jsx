/*
 * CONNECT BANK BUTTON
 *
 * Opens Plaid Link via the shared PlaidLinkProvider context.
 * usePlaidLink lives in one place only — Plaid requires a single embed per page.
 */

import { usePlaidLinkContext } from '../context/PlaidLinkContext.jsx'

function ConnectBankButton({ className = '' }) {
  const { open, ready } = usePlaidLinkContext()

  return (
    <div className="flex w-full flex-col items-center">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready}
        className={`rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        Connect Your Bank
      </button>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[#9CA3AF]">
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
    </div>
  )
}

export default ConnectBankButton
