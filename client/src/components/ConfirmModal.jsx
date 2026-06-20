/*
 * CONFIRM MODAL
 *
 * Accessible confirmation dialog for destructive actions (e.g. disconnect account).
 * Escape and overlay click call onCancel; clicks inside the card do not bubble.
 */

import { useEffect } from 'react'

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-[#1E2D45] bg-[#111827] p-6"
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
          className="mb-6 text-sm leading-relaxed text-[#9CA3AF]"
        >
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[#9CA3AF] transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
