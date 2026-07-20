/*
 * WELCOME INTRO MODAL
 *
 * One-time first-sign-in intro (no bank connected yet): three short slides
 * about What’s left, Your week / month letter, and Ask Soverm — then Connect.
 * Does not replace First Connect celebration or the activation checklist.
 */

import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

const SLIDES = [
  {
    id: 'whats-left',
    title: 'Know what’s left until payday',
    body: 'After known bills, see how much room you have to spend — so you’re not guessing before the next paycheck.',
  },
  {
    id: 'week-month',
    title: 'Your week, then a month letter',
    body: 'A simple weekly check-in (how you did, what’s left, one better move), plus a month-end condition letter when the calendar closes.',
  },
  {
    id: 'ask-soverm',
    title: 'Ask Soverm when you’re unsure',
    body: 'Afford checks, subscription keep-or-cancel help, and plain answers grounded in your synced accounts.',
  },
]

function WelcomeIntroModal({
  isOpen,
  onDismiss,
  onConnectBank,
  connectPending = false,
  connectError = false,
  isPreparingLink = false,
}) {
  const [slideIndex, setSlideIndex] = useState(0)
  const dialogRef = useRef(null)

  useFocusTrap(isOpen, dialogRef)

  useEffect(() => {
    if (!isOpen) {
      setSlideIndex(0)
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onDismiss('close')
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onDismiss])

  if (!isOpen) {
    return null
  }

  const slide = SLIDES[slideIndex]
  const isLast = slideIndex === SLIDES.length - 1
  const connectLabel = connectError
    ? 'Retry bank connection'
    : connectPending || isPreparingLink
      ? 'Preparing bank connection…'
      : 'Connect a bank'

  function handleNext() {
    if (isLast) {
      onConnectBank()
      return
    }
    setSlideIndex((index) => Math.min(index + 1, SLIDES.length - 1))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-intro-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close welcome intro"
        onClick={() => onDismiss('close')}
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-default bg-surface card-shadow-md"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)]" />

        <div className="relative p-6 sm:p-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-soft">
            Welcome to Soverm
          </p>

          <h2
            id="welcome-intro-title"
            className="mt-4 text-center text-xl font-bold text-fg sm:text-2xl"
          >
            {slide.title}
          </h2>
          <p className="mt-3 text-center text-sm leading-relaxed text-fg-muted">{slide.body}</p>

          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
            {SLIDES.map((entry, index) => (
              <span
                key={entry.id}
                className={`h-1.5 rounded-full transition ${
                  index === slideIndex ? 'w-5 bg-brand' : 'w-1.5 bg-border-default'
                }`}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNext}
              data-autofocus
              className="min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft"
            >
              {isLast ? connectLabel : 'Next'}
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={() => onDismiss('skip')}
                className="min-h-11 rounded-xl border border-border-default px-4 py-3 text-sm font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
              >
                Skip for now
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDismiss('skip')}
                className="min-h-11 rounded-xl border border-border-default px-4 py-3 text-sm font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
              >
                Maybe later
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-fg-subtle">
            Read-only via Plaid — Soverm never moves your money.
          </p>
        </div>
      </div>
    </div>
  )
}

export default WelcomeIntroModal
export { SLIDES as WELCOME_INTRO_SLIDES }
