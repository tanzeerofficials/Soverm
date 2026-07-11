import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { buildQuickQuestions } from '../lib/insightDisplay.js'
import { sendChatMessageAndRefresh } from '../lib/sendChatMessage.js'

/*
 * Quick question chips under an insight.
 *
 * Two modes:
 * - Floating chat: onAskQuestion(question) opens the modal and auto-sends
 * - Inline chat: expand the panel, then send into the same thread
 */
function InsightQuickQuestions({
  insightId,
  insight,
  onError,
  onExpandChat,
  onAskQuestion = null,
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [sendingQuestion, setSendingQuestion] = useState(null)
  const questions = buildQuickQuestions(insight)
  const handOffToFloating = typeof onAskQuestion === 'function'

  async function handleSend(question) {
    if (sendingQuestion) {
      return
    }

    if (handOffToFloating) {
      onAskQuestion(question)
      return
    }

    onExpandChat?.()
    setSendingQuestion(question)

    try {
      await sendChatMessageAndRefresh(queryClient, getToken, insightId, question)
    } catch (err) {
      console.error('Quick question failed:', err.message)
      onError?.(err.message)
    } finally {
      setSendingQuestion(null)
    }
  }

  return (
    <section className="mt-4">
      <p className="text-xs uppercase text-fg-muted">Quick questions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={!!sendingQuestion}
            onClick={() => handleSend(question)}
            className="max-w-full rounded-full bg-app px-3 py-2 text-left text-xs leading-snug text-fg-muted transition hover:bg-surface-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5"
          >
            {sendingQuestion === question ? 'Asking…' : question}
          </button>
        ))}
      </div>
    </section>
  )
}

export default InsightQuickQuestions
