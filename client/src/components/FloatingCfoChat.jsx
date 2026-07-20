/*
 * FLOATING CFO CHAT
 *
 * Persistent dashboard access to ChatPanel without scrolling to the insight.
 * Full-screen on mobile, centered modal on desktop.
 *
 * Works with or without a weekly insight: when insightId is missing we use
 * the shared "general" chat thread grounded in live synced data.
 */

import { useEffect, useRef } from 'react'
import ChatPanel from './ChatPanel.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'
import { buildDashboardSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'
import { GENERAL_CHAT_KEY } from '../lib/queryKeys.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

function FloatingCfoChatButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-warning px-4 font-semibold text-app shadow-lg transition hover:brightness-110 sm:px-5"
      aria-label="Ask Soverm"
    >
      <ChatBubbleIcon className="h-5 w-5 flex-shrink-0 text-app" />
      <span className="hidden sm:inline">Ask Soverm</span>
    </button>
  )
}

function FloatingCfoChatModal({
  isOpen,
  onClose,
  insightId,
  onChatError,
  initialDraft = '',
  autoSendInitialDraft = false,
  suggestedPrompts,
  contextLabel,
}) {
  const threadId = insightId || GENERAL_CHAT_KEY
  const prompts = suggestedPrompts ?? buildDashboardSuggestedPrompts()
  const dialogRef = useRef(null)

  useFocusTrap(isOpen, dialogRef)

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

  /*
   * Mobile shell: use dvh (dynamic viewport height) instead of h-screen/100vh.
   * On iOS Safari, 100vh is taller than the visible area, so a full-screen
   * chat can extend under the browser chrome and break nested scrolling.
   * inset-0 + h-dvh keeps the dialog exactly on the visible viewport.
   */
  return (
    <div
      className="fixed inset-0 z-[60] flex h-dvh max-h-dvh w-full items-center justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-app sm:h-[80vh] sm:max-h-[80vh] sm:w-full sm:max-w-3xl sm:rounded-xl sm:border sm:border-border-default sm:card-shadow-md"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-cfo-chat-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-default bg-app px-4 py-3 sm:rounded-t-xl">
          <div className="min-w-0">
            <h2
              id="floating-cfo-chat-title"
              className="text-sm font-semibold text-fg"
            >
              Ask Soverm
            </h2>
            <p className="truncate text-[11px] text-fg-subtle">
              Your ongoing money chat — same thread everywhere
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
            aria-label="Close chat"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
          <ChatPanel
            key={`${threadId}:${initialDraft}:${autoSendInitialDraft ? 'autosend' : 'draft'}`}
            layout="modal"
            scrollMode="modal"
            threadId={threadId}
            insightId={insightId}
            initialDraft={initialDraft}
            autoSendInitialDraft={autoSendInitialDraft}
            onError={onChatError}
            expanded
            suggestedPrompts={prompts}
            contextLabel={
              contextLabel ||
              'Your ongoing Ask Soverm chat — using your accounts, spending, and this week’s check-in when available.'
            }
            onExpandedChange={(expanded) => {
              if (!expanded) {
                onClose()
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

export { FloatingCfoChatButton, FloatingCfoChatModal }
