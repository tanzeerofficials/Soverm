/*
 * CHAT PANEL
 *
 * Follow-up Q&A for a single insight. On mobile, the input stays above the
 * keyboard via visualViewport scroll-into-view, and the thread scrolls
 * independently inside a capped-height container.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'
import { chatQueryKey } from '../lib/queryKeys.js'
import { fetchChatMessages, sendChatMessageAndRefresh } from '../lib/sendChatMessage.js'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'

const assistantMarkdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="ml-4 mb-2 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 mb-2 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-[#1A2236] px-1 text-xs">{children}</code>
  ),
}

function ChatPanel({
  insightId,
  onError,
  expanded,
  onExpandedChange,
  layout = 'inline',
  scrollMode = 'internal',
}) {
  const isModalLayout = layout === 'modal'
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { data, isPending, isError } = useQuery({
    queryKey: chatQueryKey(insightId),
    queryFn: () => fetchChatMessages(getToken, insightId),
    enabled: expanded,
  })

  const messages = data ?? []

  useEffect(() => {
    if (!expanded) {
      return
    }

    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }, [expanded])

  useEffect(() => {
    if (!expanded) {
      return
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [expanded, messages, isSending])

  useEffect(() => {
    if (!expanded) {
      return
    }

    const scrollInputIntoView = () => {
      window.setTimeout(() => {
        inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 150)
    }

    const input = inputRef.current
    input?.addEventListener('focus', scrollInputIntoView)
    window.visualViewport?.addEventListener('resize', scrollInputIntoView)

    return () => {
      input?.removeEventListener('focus', scrollInputIntoView)
      window.visualViewport?.removeEventListener('resize', scrollInputIntoView)
    }
  }, [expanded])

  function openConversation() {
    onExpandedChange(true)
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }

  async function handleSend(event) {
    event?.preventDefault()

    const text = inputValue.trim()
    if (!text || isSending) {
      return
    }

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

  if (!expanded) {
    return (
      <section id="insight-chat" className="mt-4 scroll-mt-28">
        <ChatWithCfoButton onClick={openConversation} />
      </section>
    )
  }

  return (
    <section
      id="insight-chat"
      className={
        isModalLayout
          ? 'flex min-h-0 flex-1 flex-col'
          : 'mt-4 scroll-mt-28 rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] p-4 sm:p-6'
      }
    >
      {!isModalLayout && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ChatBubbleIcon className="h-4 w-4 flex-shrink-0 text-[#8B5CF6]" />
            <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
              Ask Soverm
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            className="flex shrink-0 items-center gap-1 py-1 text-xs text-[#9CA3AF] transition hover:text-[#F9FAFB]"
          >
            Hide chat
            <svg
              className="h-3.5 w-3.5 rotate-180"
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
        </div>
      )}

      <div
        className={
          scrollMode === 'modal'
            ? 'chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto py-2 pr-1 max-sm:pb-4'
            : 'chat-scroll mb-4 max-h-[min(16rem,40dvh)] space-y-3 overflow-y-auto overscroll-y-contain border-b border-[#1E2D45] pb-4 sm:max-h-64'
        }
      >
        {isPending && (
          <p className="text-center text-xs text-[#9CA3AF]">Loading conversation…</p>
        )}
        {isError && (
          <p className="text-center text-xs text-[#EF4444]">Couldn&apos;t load messages.</p>
        )}
        {!isPending && !isError && messages.length === 0 && !isSending && (
          <p className="text-center text-xs text-[#9CA3AF]">
            Ask Soverm what concerns you.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.created_at}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] break-words rounded-lg px-3 py-2 text-sm sm:max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#1A2236] text-[#F9FAFB]'
              }`}
            >
              {message.role === 'user' ? (
                message.content
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown components={assistantMarkdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
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
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form
        onSubmit={handleSend}
        className={
          isModalLayout
            ? 'flex shrink-0 border-t border-[#1E2D45] bg-[#0A0F1C] py-3 max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:z-10 max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-3'
            : 'flex flex-col gap-2 sm:flex-row sm:items-stretch'
        }
      >
        {isModalLayout ? (
          <div className="flex w-full items-center rounded-xl border border-[#1E2D45] bg-[#111827] p-1.5 transition focus-within:border-[#8B5CF6]/40 focus-within:ring-1 focus-within:ring-[#8B5CF6]/20">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Ask Soverm anything about your money…"
              disabled={isSending}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#F9FAFB] placeholder:text-[#6B7280] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6] text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.545h5.126a.75.75 0 010 1.5H4.643a.75.75 0 00-.732.573l-1.414 5.5a.75.75 0 00.977.826l12.5-5.5a.75.75 0 000-1.382l-12.5-5.5a.75.75 0 00-.826.039z" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="relative min-w-0 flex-1">
              <ChatBubbleIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask Soverm anything about your money…"
                disabled={isSending}
                className="w-full min-h-11 rounded-lg border border-[#1E2D45] bg-[#0A0F1C] py-2.5 pl-10 pr-3 text-base text-[#F9FAFB] placeholder:text-[#6B7280] focus:border-[#8B5CF6] focus:outline-none disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="min-h-11 w-full shrink-0 rounded-lg bg-[#8B5CF6] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Send
            </button>
          </>
        )}
      </form>
    </section>
  )
}

export default ChatPanel
