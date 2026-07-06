/*
 * HISTORY INSIGHT MODAL
 *
 * Full-screen on mobile, centered panel on desktop. Reuses InsightCard
 * so chat, actions, and summary behave exactly like the dashboard.
 */

import { useEffect } from 'react'
import InsightCard from './InsightCard.jsx'

function HistoryInsightModal({ isOpen, insight, onClose, onChatError }) {
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

  if (!isOpen || !insight) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60 sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex h-full w-full flex-col overflow-y-auto bg-app sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl sm:border sm:border-border-default sm:shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-insight-modal-title"
      >
        <div className="sticky top-0 z-10 flex justify-end border-b border-border-default bg-app/95 px-4 py-3 backdrop-blur sm:rounded-t-xl">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
            aria-label="Close insight"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-4 pb-8 pt-2 sm:px-6">
          <h2 id="history-insight-modal-title" className="sr-only">
            {insight.headline}
          </h2>
          <InsightCard
            key={insight.id}
            insight={insight}
            onChatError={onChatError}
          />
        </div>
      </div>
    </div>
  )
}

export default HistoryInsightModal
