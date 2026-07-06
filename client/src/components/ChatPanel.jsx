/*
 * CHAT PANEL
 *
 * Interactive Ask Soverm — multi-turn Q&A grounded in the user's synced data.
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
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-[#1A2236] px-1 text-xs">{children}</code>
  ),
}

function ChatSuggestedPrompts({ prompts, disabled, onSelect }) {
  if (!prompts?.length) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
        Try asking
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt)}
            className="max-w-full rounded-full border border-[#1E2D45] bg-[#0A0F1C] px-3 py-2 text-left text-xs leading-snug text-[#D1D5DB] transition hover:border-[#8B5CF6]/40 hover:bg-[#1A2236] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatPanel({
  insightId,
  onError,
  expanded,
  onExpandedChange,
  layout = 'inline',
  scrollMode = 'internal',
  suggestedPrompts = [],
  contextLabel = 'Answers use your synced accounts, recent transactions, and Expense Analyzer data.',
}) {
  const isModalLayout = layout === 'modal'
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  const { data, isPending, isError } = useQuery({
    queryKey: chatQueryKey(insightId),
    queryFn: () => fetchChatMessages(getToken, insightId),
    enabled: expanded,
  })

  const messages = data ?? []
  const showSuggestedPrompts = !isPending && !isError && messages.length === 0 && !isSending

  function scrollMessagesToBottom(behavior = 'smooth') {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
  }

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

    scrollMessagesToBottom(messages.length <= 1 ? 'auto' : 'smooth')
  }, [expanded, messages, isSending])

  useEffect(() => {
    if (!expanded || !isModalLayout) {
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
  }, [expanded, isModalLayout])

  function openConversation() {
    onExpandedChange(true)
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }

  async function submitMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || isSending) {
      return
    }

    setInputValue('')
    setIsSending(true)
    scrollMessagesToBottom('auto')

    try {
      await sendChatMessageAndRefresh(queryClient, getToken, insightId, trimmed)
    } catch (err) {
      console.error('Failed to send chat message:', err.message)
      setInputValue(trimmed)
      onError?.(err.message)
    } finally {
      setIsSending(false)
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    }
  }

  async function handleSend(event) {
    event?.preventDefault()
    await submitMessage(inputValue)
  }

  function handleInputKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend(event)
    }
  }

  if (!expanded) {
    return (
      <section id="insight-chat" className="mt-4 scroll-mt-28">
        <ChatWithCfoButton onClick={openConversation} />
      </section>
    )
  }

  const messageScrollClass =
    scrollMode === 'modal'
      ? 'chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1 max-sm:pb-4'
      : 'chat-scroll mb-4 max-h-[min(24rem,50dvh)] space-y-4 overflow-y-auto overscroll-y-contain border-b border-[#1E2D45] pb-4 sm:max-h-96'

  const inputControlClass =
    'w-full min-h-[2.75rem] max-h-32 resize-y rounded-lg border border-[#1E2D45] bg-[#0A0F1C] py-2.5 text-base leading-relaxed text-[#F9FAFB] placeholder:text-[#6B7280] focus:border-[#8B5CF6] focus:outline-none disabled:opacity-60'

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
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
                Ask Soverm
              </h3>
              <p className="truncate text-[11px] text-[#6B7280]">
                Chat about your money — subscriptions, spending, and more
              </p>
            </div>
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

      <div ref={messagesContainerRef} className={messageScrollClass}>
        {isPending && (
          <p className="text-center text-xs text-[#9CA3AF]">Loading conversation…</p>
        )}
        {isError && (
          <p className="text-center text-xs text-[#EF4444]">Couldn&apos;t load messages.</p>
        )}
        {showSuggestedPrompts && (
          <div className="rounded-lg border border-dashed border-[#1E2D45] bg-[#0A0F1C]/50 px-4 py-4">
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Ask anything about your spending, subscriptions, categories, or general money
              questions — Soverm has your synced data.
            </p>
            <div className="mt-4">
              <ChatSuggestedPrompts
                prompts={suggestedPrompts}
                disabled={isSending}
                onSelect={submitMessage}
              />
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.created_at}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] break-words rounded-xl px-3.5 py-2.5 text-sm sm:max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#1A2236] text-[#F9FAFB]'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
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
            <div className="rounded-xl bg-[#1A2236] px-3.5 py-2.5">
              <p className="text-xs text-[#9CA3AF]">Soverm is thinking…</p>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B5CF6]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B5CF6] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B5CF6] [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form
        onSubmit={handleSend}
        className={
          isModalLayout
            ? 'flex shrink-0 flex-col gap-2 border-t border-[#1E2D45] bg-[#0A0F1C] py-3 max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:z-10 max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-3'
            : 'flex flex-col gap-2'
        }
      >
        {isModalLayout ? (
          <div className="flex w-full items-end gap-2 rounded-xl border border-[#1E2D45] bg-[#111827] p-1.5 transition focus-within:border-[#8B5CF6]/40 focus-within:ring-1 focus-within:ring-[#8B5CF6]/20">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask about spending, subscriptions, budgets…"
              disabled={isSending}
              className={`${inputControlClass} min-w-0 flex-1 resize-none border-0 bg-transparent px-3 focus:border-0 focus:ring-0`}
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6] text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.545h5.126a.75.75 0 010 1.5H4.643a.75.75 0 00-.732.573l-1.414 5.5a.75.75 0 00.977.826l12.5-5.5a.75.75 0 000-1.382l-12.5-5.5a.75.75 0 00-.826.039z" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="relative min-w-0">
              <ChatBubbleIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6B7280]" />
              <textarea
                ref={inputRef}
                rows={2}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Ask about spending, subscriptions, budgets… (Enter to send, Shift+Enter for new line)"
                disabled={isSending}
                className={`${inputControlClass} pl-10 pr-3`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] leading-relaxed text-[#6B7280]">{contextLabel}</p>
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                className="min-h-10 shrink-0 rounded-lg bg-[#8B5CF6] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
        {isModalLayout && (
          <p className="text-center text-[11px] leading-relaxed text-[#6B7280]">{contextLabel}</p>
        )}
      </form>
    </section>
  )
}

export default ChatPanel
