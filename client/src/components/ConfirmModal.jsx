/*
 * CONFIRM MODAL
 *
 * Accessible confirmation dialog for destructive actions (e.g. disconnect account).
 * Optional confirmationPhrase requires typing an exact string before confirming.
 */

import { useEffect, useState } from 'react'

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
        className="w-full max-w-sm rounded-xl border border-[#1E2D45] bg-[#111827] p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h2
          id="confirm-modal-title"
          className="mb-2 text-lg font-semibold text-[#F9FAFB]"
        >
          {title}
        </h2>

        <p
          id="confirm-modal-message"
          className="mb-4 text-sm leading-relaxed text-[#9CA3AF]"
        >
          {message}
        </p>

        {phraseRequired && (
          <div className="mb-6">
            <label
              htmlFor="confirm-modal-phrase"
              className="mb-2 block text-xs text-[#9CA3AF]"
            >
              Type <span className="font-mono text-[#F9FAFB]">{confirmationPhrase}</span>{' '}
              to confirm
            </label>
            <input
              id="confirm-modal-phrase"
              type="text"
              value={typedPhrase}
              onChange={(event) => setTypedPhrase(event.target.value)}
              autoComplete="off"
              className="w-full min-h-11 rounded-lg border border-[#1E2D45] bg-[#0A0F1C] px-3 py-2 text-base text-[#F9FAFB] focus:border-red-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 py-2 text-sm text-[#9CA3AF] transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!phraseMatches || isConfirming}
            className="min-h-11 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
