/*
 * SECURITY NOTE
 *
 * Dismissible info card that explains how Soverm handles financial data.
 * Transparency about the data flow (Plaid, encryption, disconnect) builds
 * trust better than a vague "secure" label alone.
 */

import { useState } from 'react'
import { dismissSecurityNote, isSecurityNoteDismissed } from '../lib/dashboardUiPrefs.js'

function SecurityNote() {
  const [dismissed, setDismissed] = useState(() => isSecurityNoteDismissed())

  if (dismissed) return null

  function handleDismiss() {
    dismissSecurityNote()
    setDismissed(true)
  }

  return (
    <div className="relative rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-4 text-sm">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-xs text-fg-muted transition hover:text-fg"
      >
        Got it
      </button>

      <svg
        className="h-4 w-4 text-brand"
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

      <h3 className="mt-2 text-sm font-semibold text-fg">
        How Soverm keeps your data safe
      </h3>

      <p className="mt-2 text-xs leading-relaxed text-fg-muted">
        Soverm never sees or stores your bank login credentials. Plaid handles the
        secure connection to your bank and shares only your account balances and
        transactions with us. Your financial data is stored in an encrypted database
        that only you can access. You can disconnect any account at any time — disconnected
        spending won&apos;t appear in new Expense Analyzer views, but your history is kept.
      </p>
    </div>
  )
}

export default SecurityNote
