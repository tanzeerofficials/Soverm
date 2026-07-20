/*
 * CONFIRM MODAL
 *
 * Accessible confirmation dialog for destructive actions (e.g. disconnect account).
 * Optional confirmationPhrase requires typing an exact string before confirming.
 */

import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmationPhrase,
  isConfirming = false,
  onConfirm,
  onCancel,
}) {
  const [typedPhrase, setTypedPhrase] = useState('')
  const dialogRef = useRef(null)

  useFocusTrap(isOpen, dialogRef)

  useEffect(() => {
    if (!isOpen) {
      setTypedPhrase('')
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const phraseRequired = Boolean(confirmationPhrase)
  const phraseMatches = !phraseRequired || typedPhrase === confirmationPhrase

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-border-default bg-surface p-6 card-shadow-md"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h2
          id="confirm-modal-title"
          className="mb-2 text-lg font-semibold text-fg"
        >
          {title}
        </h2>

        <p
          id="confirm-modal-message"
          className="mb-4 text-sm leading-relaxed text-fg-muted"
        >
          {message}
        </p>

        {phraseRequired && (
          <div className="mb-6">
            <label
              htmlFor="confirm-modal-phrase"
              className="mb-2 block text-xs text-fg-muted"
            >
              Type <span className="font-mono text-fg">{confirmationPhrase}</span>{' '}
              to confirm
            </label>
            <input
              id="confirm-modal-phrase"
              type="text"
              value={typedPhrase}
              onChange={(event) => setTypedPhrase(event.target.value)}
              autoComplete="off"
              data-autofocus
              className="w-full min-h-11 rounded-lg border border-border-default bg-app px-3 py-2 text-base text-fg focus:border-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 py-2 text-sm text-fg-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!phraseMatches || isConfirming}
            data-autofocus={!phraseRequired ? 'true' : undefined}
            className="min-h-11 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-fg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
