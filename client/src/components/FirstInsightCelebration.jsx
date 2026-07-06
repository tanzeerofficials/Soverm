/*
 * FIRST INSIGHT CELEBRATION
 *
 * Shown once when a user generates their very first insight —
 * confetti burst plus a short banner above the insight card.
 */

import { useEffect, useState } from 'react'
import ConfettiBurst from './ConfettiBurst.jsx'

function FirstInsightCelebration({ isOpen, onDismiss }) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <>
      <ConfettiBurst
        active={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      <div
        className="first-insight-banner mb-4 overflow-hidden rounded-xl border border-ai/30 bg-gradient-to-r from-ai/15 via-surface to-brand/10 p-4 sm:p-5"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ai/35 bg-ai/15">
              <svg
                className="h-5 w-5 text-ai-soft"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <path
                  d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.4 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3z"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">Your first insight is ready</p>
              <p className="mt-0.5 text-sm text-fg-muted">
                Soverm analyzed your synced transactions. Read your summary below — then try the
                action checklist or ask a follow-up question.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 self-start rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg sm:self-center"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  )
}

export default FirstInsightCelebration
