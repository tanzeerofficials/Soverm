/*
 * CONNECT BANK BUTTON
 *
 * Opens Plaid Link via the shared PlaidLinkProvider context.
 * usePlaidLink lives in one place only — Plaid requires a single embed per page.
 *
 * If the link token failed to load, we show a retry path instead of a
 * permanently disabled button with no explanation.
 */

import { usePlaidLinkContext } from '../context/PlaidLinkContext.jsx'
import { trackConnectBankClick } from '../lib/analytics.js'
import { isDemoSession } from '../lib/demoSession.js'

function ConnectBankButton({
  className = '',
  highlighted = false,
  showSecurityNote = true,
  /*
   * Optional custom label for maintenance surfaces (e.g. “Add another bank”).
   * Loading / error states still use clear system copy so users aren’t stuck.
   */
  label: labelOverride = null,
  variant = 'primary',
}) {
  const {
    open,
    ready,
    isExchanging,
    isFetchingLinkToken,
    linkTokenError,
    retryLinkToken,
  } = usePlaidLinkContext()

  // Demo sessions can't link banks (server 403s anyway) — say so plainly
  // instead of showing a dead disabled button.
  if (isDemoSession()) {
    return (
      <div className={`flex w-full max-w-full flex-col items-center ${className}`}>
        <button
          type="button"
          disabled
          title="Bank connections are disabled in the demo"
          className="min-h-11 w-full cursor-not-allowed rounded-lg border border-border-default bg-surface/80 px-4 py-3 text-sm font-semibold text-fg-subtle"
        >
          Connect Your Bank
        </button>
        <p className="mt-2 max-w-[280px] text-center text-[11px] leading-snug text-fg-muted sm:text-xs">
          Disabled in demo — sign up to connect your own bank.
        </p>
      </div>
    )
  }

  const defaultLabel = isExchanging
    ? 'Connecting & syncing…'
    : isFetchingLinkToken
      ? 'Preparing connection…'
      : linkTokenError
        ? 'Retry bank connection'
        : 'Connect Your Bank'

  const label =
    labelOverride && !isExchanging && !isFetchingLinkToken && !linkTokenError
      ? labelOverride
      : defaultLabel

  function handleClick() {
    if (linkTokenError) {
      retryLinkToken()
      return
    }

    trackConnectBankClick()
    open()
  }

  const isSecondary = variant === 'secondary'
  const buttonClass = isSecondary
    ? `min-h-11 w-full rounded-lg border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand-soft transition hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-60 ${className}`
    : `min-h-11 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60 ${
        highlighted && !isExchanging ? 'animate-pulse' : ''
      } ${className}`

  return (
    <div
      className={`flex w-full max-w-full flex-col items-center ${
        highlighted && !isSecondary
          ? 'rounded-lg ring-2 ring-brand ring-offset-1 ring-offset-app'
          : ''
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={(!ready && !linkTokenError) || isExchanging || isFetchingLinkToken}
        className={buttonClass}
      >
        {label}
      </button>
      {linkTokenError && (
        <p className="mt-2 max-w-[280px] text-center text-[11px] leading-snug text-danger sm:text-xs">
          {linkTokenError}
        </p>
      )}
      {showSecurityNote && !linkTokenError && (
      <p className="mt-2 flex max-w-[280px] items-center justify-center gap-1.5 px-1 text-center text-[11px] leading-snug text-fg-muted sm:text-xs">
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
