import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatQueryKey } from '../lib/queryKeys.js'
import { fetchChatMessages, sendChatMessageAndRefresh } from '../lib/sendChatMessage.js'

function ChatBubbleIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}

function ChatPanel({ insightId, onError, expanded, onExpandedChange }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { data, isPending, isError } = useQuery({
    queryKey: chatQueryKey(insightId),
    queryFn: () => fetchChatMessages(getToken, insightId),
    enabled: expanded,
  })

  const messages = data ?? []
  const hasConversation = messages.length > 0 || isSending

  function openConversation() {
    onExpandedChange(true)
  }

  async function handleSend(event) {
    event?.preventDefault()

    const text = inputValue.trim()
    if (!text || isSending) {
      return
    }

    openConversation()
    setInputValue('')
    setIsSending(true)

    try {
      await sendChatMessageAndRefresh(
        queryClient,
        getToken,
        insightId,
        text
      )
    } catch (err) {
      console.error('Failed to send chat message:', err.message)
      setInputValue(text)
      onError?.(err.message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChatBubbleIcon className="h-4 w-4 flex-shrink-0 text-[#8B5CF6]" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
            Ask your AI CFO
          </h3>
        </div>
        {hasConversation && (
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="flex items-center gap-1 text-xs text-[#9CA3AF] transition hover:text-[#F9FAFB]"
          >
            {expanded ? 'Hide chat' : 'View chat'}
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="mb-4 max-h-64 space-y-3 overflow-y-auto border-b border-[#1E2D45] pb-4">
          {isPending && (
            <p className="text-center text-xs text-[#9CA3AF]">Loading conversation…</p>
          )}
          {isError && (
            <p className="text-center text-xs text-[#EF4444]">Couldn&apos;t load messages.</p>
          )}
          {!isPending && !isError && messages.length === 0 && !isSending && (
            <p className="text-center text-xs text-[#9CA3AF]">
              Ask a follow-up about this insight.
            </p>
          )}
          {messages.map((message, index) => (
            <div
              key={`${message.created_at}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#1A2236] text-[#F9FAFB]'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <p className="rounded-lg bg-[#1A2236] px-3 py-2 text-xs italic text-[#9CA3AF]">
                Soverm is thinking…
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <ChatBubbleIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onFocus={openConversation}
            placeholder="Ask Soverm about this insight…"
            disabled={isSending}
            className="w-full rounded-lg border border-[#1E2D45] bg-[#0A0F1C] py-2.5 pl-10 pr-3 text-sm text-[#F9FAFB] placeholder:text-[#6B7280] focus:border-[#8B5CF6] focus:outline-none disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isSending || !inputValue.trim()}
          className="rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </section>
  )
}

export default ChatPanel
