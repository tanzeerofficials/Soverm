/*
 * FIRST CONNECT CELEBRATION
 *
 * Shown once after a user links their first bank account — confirms success
 * and nudges them toward generating their first insight.
 */

import { useEffect } from 'react'

function FirstConnectCelebration({ isOpen, accountsConnected = 1, syncedAdded = 0, onClose, onGenerateInsight }) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-connect-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close celebration"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-default bg-surface shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-ai/15 blur-3xl" />

        <div className="relative p-6 sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10">
            <svg className="h-7 w-7 text-brand-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 id="first-connect-title" className="mt-5 text-center text-2xl font-bold text-fg">
            You&apos;re connected!
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-fg-muted">
            {accountsConnected === 1
              ? 'Your first account is linked and synced.'
              : `${accountsConnected} accounts are linked and synced.`}
            {syncedAdded > 0
              ? ` Soverm pulled in ${syncedAdded} transaction${syncedAdded === 1 ? '' : 's'} to get started.`
              : ' Soverm is ready to analyze your activity.'}
          </p>

          <ol className="mt-6 space-y-2">
            {[
              'Bank connected securely via Plaid',
              'Transactions synced to Soverm',
              'Generate your first insight',
            ].map((step, index) => (
              <li
                key={step}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                  index < 2
                    ? 'border-brand/25 bg-brand/5 text-fg'
                    : 'border-ai/25 bg-ai/5 text-fg'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    index < 2 ? 'bg-brand/15 text-brand-soft' : 'bg-ai/15 text-ai-soft'
                  }`}
                >
                  {index < 2 ? '✓' : '3'}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onGenerateInsight}
              className="min-h-11 flex-1 rounded-xl bg-ai/15 px-4 py-3 text-sm font-semibold text-ai-soft ring-1 ring-ai/35 transition hover:bg-ai/25"
            >
              Generate my first insight
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-border-default px-4 py-3 text-sm font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
            >
              Explore dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FirstConnectCelebration
