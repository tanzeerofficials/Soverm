/*
 * FLOATING CFO CHAT
 *
 * Persistent dashboard access to ChatPanel without scrolling to the insight.
 * Full-screen on mobile, centered modal on desktop.
 */

import { useEffect } from 'react'
import ChatPanel from './ChatPanel.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'
import { buildDashboardSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'

function FloatingCfoChatButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-warning px-4 font-semibold text-app shadow-lg transition hover:brightness-110 sm:px-5"
      aria-label="Ask Soverm"
    >
      <ChatBubbleIcon className="h-5 w-5 flex-shrink-0 text-app" />
      <span className="hidden sm:inline">Ask Soverm</span>
    </button>
  )
}

function FloatingCfoChatModal({ isOpen, onClose, insightId, onChatError }) {
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
      className="fixed inset-0 z-[60] flex h-screen w-screen items-center justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-app sm:h-[80vh] sm:max-h-[80vh] sm:w-full sm:max-w-3xl sm:rounded-xl sm:border sm:border-border-default sm:shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-cfo-chat-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-default bg-app px-4 py-3 sm:rounded-t-xl">
          <h2
            id="floating-cfo-chat-title"
            className="text-sm font-semibold text-fg"
          >
            Ask Soverm
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-elevated hover:text-white"
            aria-label="Close chat"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
          {insightId ? (
            <ChatPanel
              key={insightId}
              layout="modal"
              scrollMode="modal"
              insightId={insightId}
              onError={onChatError}
              expanded
              suggestedPrompts={buildDashboardSuggestedPrompts()}
              contextLabel="Grounded in your synced accounts, recent transactions, and Expense Analyzer data."
              onExpandedChange={(expanded) => {
                if (!expanded) {
                  onClose()
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-fg-muted">
                Generate your first insight to ask Soverm a question to get started
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-default bg-surface px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-surface-elevated"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { FloatingCfoChatButton, FloatingCfoChatModal }
