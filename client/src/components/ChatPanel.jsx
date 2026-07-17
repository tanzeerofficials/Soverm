/*
 * CHAT PANEL
 *
 * Interactive Ask Soverm — multi-turn Q&A grounded in the user's synced data.
 *
 * Layout model (modal):
 *   [ messages — flex-1, scrolls independently ]
 *   [ composer — shrink-0, always visible ]
 * The composer stays in normal document flow (not position:fixed) so long
 * replies are never hidden behind the input bar on mobile.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'
import SovermPlanCards from './SovermPlanCards.jsx'
import { chatQueryKey, chatLimitsQueryKey, GENERAL_CHAT_KEY } from '../lib/queryKeys.js'
import { fetchChatMessages, sendChatMessageAndRefresh } from '../lib/sendChatMessage.js'
import { splitAssistantContent, copyTextToClipboard, formatAssistantShareText } from '../lib/parseSovermPlan.js'
import {
  CHAT_HARD_TIMEOUT_MS,
  classifyChatNetworkError,
  getChatWaitCopy,
  getChatWaitPhase,
} from '../lib/chatWaitStatus.js'
import { fetchChatLimits, formatChatLimitLabel } from '../lib/fetchChatLimits.js'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'

const NEAR_BOTTOM_PX = 80

const assistantMarkdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold text-white first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-fg">{children}</h4>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-ai-soft underline underline-offset-2 hover:text-white"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-ai/40 pl-3 text-fg-muted">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-app/60 px-1 text-xs text-fg">{children}</code>
  ),
}

function ChatSuggestedPrompts({ prompts, disabled, onSelect }) {
  if (!prompts?.length) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        Try asking
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt)}
            className="max-w-full rounded-full border border-border-default bg-app px-3 py-2 text-left text-xs leading-snug text-fg-muted transition hover:border-ai/40 hover:bg-surface-elevated hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

function CopyMessageButton({ content, disabled = false }) {
  const [copyState, setCopyState] = useState('idle')

  async function handleCopy() {
    if (disabled || !content?.trim()) {
      return
    }
    try {
      await copyTextToClipboard(formatAssistantShareText(content))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className="mt-1.5 text-[11px] font-medium text-fg-subtle transition hover:text-ai-soft disabled:opacity-40"
      aria-label="Copy message"
    >
      {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
    </button>
  )
}

function AssistantMessageBody({
  content,
  streaming = false,
  waitPhase = 'writing',
  serverStatus = null,
}) {
  /*
   * While tokens are still arriving, hide a half-written ```soverm-plan fence
   * so users don't see raw JSON. Once complete, split into markdown + cards.
   */
  const visibleContent = streaming
    ? content.replace(/```soverm-plan[\s\S]*$/i, '').trimEnd()
    : content
  const { markdown, plan } = streaming
    ? { markdown: visibleContent, plan: null }
    : splitAssistantContent(content)
  const waitCopy = getChatWaitCopy(waitPhase, serverStatus)
  const showWaitState = streaming && !markdown

  return (
    <div>
      <div className="prose prose-invert prose-sm max-w-none">
        {markdown ? (
          <ReactMarkdown components={assistantMarkdownComponents}>{markdown}</ReactMarkdown>
        ) : showWaitState ? (
          <div aria-live="polite">
            <p className="text-xs text-fg-muted">{waitCopy.title}</p>
            {waitCopy.detail ? (
              <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">{waitCopy.detail}</p>
            ) : null}
            <div className="mt-2 flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}
        {!streaming && plan ? <SovermPlanCards plan={plan} /> : null}
        {streaming && content ? (
          <span
            className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-ai align-middle"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {!streaming && content?.trim() ? <CopyMessageButton content={content} /> : null}
    </div>
  )
}

function ChatSendingStatus({ phase, serverStatus = null, onRetry, onCancel }) {
  const copy = getChatWaitCopy(phase, serverStatus)
  const showActions = phase === 'slow'

  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="max-w-[92%] rounded-xl bg-surface-elevated px-3.5 py-2.5 sm:max-w-[85%]">
        <p className="text-xs text-fg-muted">{copy.title}</p>
        {copy.detail ? (
          <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">{copy.detail}</p>
        ) : null}
        <div className="mt-2 flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:300ms]" />
        </div>
        {showActions ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-brand-soft hover:underline"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-fg-muted hover:text-fg hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ChatPanel({
  insightId,
  threadId,
  onError,
  expanded,
  onExpandedChange,
  layout = 'inline',
  scrollMode = 'internal',
  suggestedPrompts = [],
  contextLabel = 'Answers use your synced accounts, recent transactions, and Expense Analyzer data.',
  initialDraft = '',
  autoSendInitialDraft = false,
}) {
  const isModalLayout = layout === 'modal'
  const resolvedThreadId = threadId ?? insightId ?? GENERAL_CHAT_KEY
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const autoSendRef = useRef(false)
  const abortRef = useRef(null)
  const sendStartedAtRef = useRef(0)
  const pendingRetryRef = useRef(null)
  const userCancelledRef = useRef(false)
  const [inputValue, setInputValue] = useState(autoSendInitialDraft ? '' : initialDraft)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [waitElapsedMs, setWaitElapsedMs] = useState(0)

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: chatQueryKey(resolvedThreadId),
    queryFn: () => fetchChatMessages(getToken, resolvedThreadId),
    enabled: expanded,
  })

  const { data: chatLimits } = useQuery({
    queryKey: chatLimitsQueryKey,
    queryFn: () => fetchChatLimits(getToken),
    enabled: expanded,
    staleTime: 30_000,
  })

  const chatLimitLabel = formatChatLimitLabel(chatLimits)
  const chatNearLimit =
    Number.isFinite(chatLimits?.remaining) &&
    Number.isFinite(chatLimits?.limit) &&
    chatLimits.remaining <= Math.max(3, Math.floor(chatLimits.limit * 0.2))

  useEffect(() => {
    if (initialDraft && !autoSendInitialDraft) {
      setInputValue(initialDraft)
    }
  }, [initialDraft, autoSendInitialDraft])

  const messages = data ?? []
  const streamingMessage = messages.find((message) => message.streaming)
  const hasStreamingReply = Boolean(streamingMessage)
  const hasStreamingTokens = Boolean(streamingMessage?.content)
  const serverStatus = streamingMessage
    ? {
        phase: streamingMessage.statusPhase || null,
        title: streamingMessage.statusTitle || null,
        detail: streamingMessage.statusDetail || null,
      }
    : null
  const showSuggestedPrompts =
    !isPending && !isError && messages.length === 0 && !isSending && !hasStreamingReply
  const waitPhase = getChatWaitPhase(waitElapsedMs, {
    hasTokens: hasStreamingTokens,
    activity: serverStatus?.phase,
  })
  const isWaitingOnReply = isSending || hasStreamingReply

  useEffect(() => {
    if (!isWaitingOnReply) {
      setWaitElapsedMs(0)
      return
    }

    sendStartedAtRef.current = sendStartedAtRef.current || Date.now()
    setWaitElapsedMs(Date.now() - sendStartedAtRef.current)

    const intervalId = window.setInterval(() => {
      setWaitElapsedMs(Date.now() - sendStartedAtRef.current)
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [isWaitingOnReply])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function isNearBottom(container) {
    if (!container) {
      return true
    }
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    return distance <= NEAR_BOTTOM_PX
  }

  function scrollMessagesToBottom(behavior = 'smooth') {
    const end = messagesEndRef.current
    if (end) {
      end.scrollIntoView({ behavior, block: 'end' })
      return
    }

    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
  }

  function handleMessagesScroll() {
    const nearBottom = isNearBottom(messagesContainerRef.current)
    stickToBottomRef.current = nearBottom
    setShowJumpToLatest(!nearBottom && messages.length > 0)
  }

  /*
   * Textarea auto-grow: match height to content up to max-h-32 so multi-line
   * questions stay readable on mobile without a tiny one-line box.
   */
  useLayoutEffect(() => {
    if (!isModalLayout || !expanded) {
      return
    }

    const input = inputRef.current
    if (!input) {
      return
    }

    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`
  }, [inputValue, isModalLayout, expanded])

  useEffect(() => {
    if (!expanded) {
      return
    }

    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }, [expanded])

  /*
   * Auto-send deep-link prompts (Ask Soverm from a subscription / bill finding).
   * Wait until history has loaded so we don't race the empty-state UI, and only
   * fire once per ChatPanel mount (guarded by autoSendRef).
   */
  useEffect(() => {
    if (!expanded || !autoSendInitialDraft) {
      return
    }
    if (autoSendRef.current || isPending || isError || isSending) {
      return
    }

    const prompt = initialDraft.trim()
    if (!prompt) {
      return
    }

    autoSendRef.current = true
    submitMessage(prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit once when history is ready
  }, [
    expanded,
    autoSendInitialDraft,
    initialDraft,
    isPending,
    isError,
    isSending,
  ])

  useEffect(() => {
    if (!expanded) {
      return
    }

    /*
     * Only auto-scroll when the user is already near the bottom (or sending).
     * If they scrolled up to re-read history, don't yank them back down.
     */
    const shouldStick = stickToBottomRef.current || isSending || messages.length <= 1
    if (!shouldStick) {
      setShowJumpToLatest(true)
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

  function cancelInFlightSend({ restoreDraft = true } = {}) {
    userCancelledRef.current = true
    const active = abortRef.current
    abortRef.current = null
    active?.abort()
    sendStartedAtRef.current = 0
    setIsSending(false)
    if (restoreDraft && pendingRetryRef.current) {
      setInputValue(pendingRetryRef.current)
    }
  }

  function retryInFlightOrFailed() {
    const draft = pendingRetryRef.current || inputValue
    cancelInFlightSend({ restoreDraft: false })
    setSendError(null)
    if (!draft.trim()) {
      return
    }
    window.setTimeout(() => {
      userCancelledRef.current = false
      submitMessage(draft)
    }, 0)
  }

  async function submitMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || isSending) {
      return
    }

    const previous = abortRef.current
    abortRef.current = null
    previous?.abort()

    const controller = new AbortController()
    abortRef.current = controller
    userCancelledRef.current = false
    pendingRetryRef.current = trimmed
    sendStartedAtRef.current = Date.now()
    setWaitElapsedMs(0)

    setInputValue('')
    setSendError(null)
    setIsSending(true)
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    scrollMessagesToBottom('auto')

    const timeoutId = window.setTimeout(() => {
      if (abortRef.current === controller) {
        controller.abort()
      }
    }, CHAT_HARD_TIMEOUT_MS)

    try {
      await sendChatMessageAndRefresh(
        queryClient,
        getToken,
        resolvedThreadId,
        trimmed,
        { signal: controller.signal }
      )
      if (abortRef.current === controller) {
        pendingRetryRef.current = null
      }
    } catch (err) {
      console.error('Failed to send chat message:', err.message)

      // A newer send superseded this one — ignore its failure.
      if (abortRef.current && abortRef.current !== controller) {
        return
      }

      const timedOut =
        err?.name === 'AbortError' &&
        !userCancelledRef.current &&
        Date.now() - sendStartedAtRef.current >= CHAT_HARD_TIMEOUT_MS - 100

      if (userCancelledRef.current && err?.name === 'AbortError' && !timedOut) {
        setInputValue(trimmed)
        setSendError(null)
      } else {
        setInputValue(trimmed)
        const message = classifyChatNetworkError(err, { timedOut })
        setSendError(message)
        if (err?.name !== 'AbortError' || timedOut) {
          onError?.(message)
        }
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (abortRef.current === controller) {
        abortRef.current = null
        sendStartedAtRef.current = 0
        setIsSending(false)
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
      }
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

  /*
   * Modal message list: flex-1 + min-h-0 + overflow-y-auto so THIS box scrolls,
   * not the page. Composer stays in flex flow so content never hides behind it.
   */
  const messageScrollClass =
    scrollMode === 'modal'
      ? 'chat-scroll relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain py-2 pr-1 pb-4 [-webkit-overflow-scrolling:touch]'
      : 'chat-scroll mb-4 max-h-[min(24rem,50dvh)] space-y-4 overflow-y-auto overscroll-y-contain border-b border-border-default pb-4 sm:max-h-96'

  const inputControlClass =
    'w-full min-h-[2.75rem] max-h-32 resize-y rounded-lg border border-border-default bg-app py-2.5 text-base leading-relaxed text-fg placeholder:text-fg-subtle focus:border-ai focus:outline-none disabled:opacity-60'

  return (
    <section
      id="insight-chat"
      className={
        isModalLayout
          ? 'flex min-h-0 flex-1 flex-col'
          : 'mt-4 scroll-mt-28 rounded-xl border border-border-default border-l-4 border-l-ai bg-surface p-4 sm:p-6'
      }
    >
      {!isModalLayout && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ChatBubbleIcon className="h-4 w-4 flex-shrink-0 text-ai" />
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-ai">
                Ask Soverm
              </h3>
              <p className="truncate text-[11px] text-fg-subtle">
                Chat about your money — subscriptions, spending, and more
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            className="flex shrink-0 items-center gap-1 py-1 text-xs text-fg-muted transition hover:text-fg"
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
        ref={messagesContainerRef}
        className={messageScrollClass}
        onScroll={handleMessagesScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isPending || isSending}
        aria-label="Conversation with Soverm"
      >
        {isPending && (
          <p className="text-center text-xs text-fg-muted">Loading conversation…</p>
        )}
        {isError && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3 text-center">
            <p className="text-xs text-danger">Couldn&apos;t load messages.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-xs font-semibold text-brand-soft hover:underline"
            >
              Try again
            </button>
          </div>
        )}
        {showSuggestedPrompts && (
          <div className="rounded-lg border border-dashed border-border-default bg-app/50 px-4 py-4">
            <p className="text-sm leading-relaxed text-fg-muted">
              Ask about what&apos;s left until payday, a night-out budget, how to save more,
              filing taxes, or anything money-related — Soverm uses your synced data when it
              helps.
            </p>
            <p className="mt-2 text-xs text-fg-subtle">
              For the full weekly check-in, open{' '}
              <Link to="/weekly-review" className="font-semibold text-ai-soft hover:underline">
                Your week
              </Link>
              .
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
                  : 'bg-surface-elevated text-fg'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              ) : (
                <AssistantMessageBody
                  content={message.content}
                  streaming={Boolean(message.streaming)}
                  waitPhase={message.streaming ? waitPhase : 'writing'}
                  serverStatus={
                    message.streaming
                      ? {
                          phase: message.statusPhase || null,
                          title: message.statusTitle || null,
                          detail: message.statusDetail || null,
                        }
                      : null
                  }
                />
              )}
            </div>
          </div>
        ))}
        {isSending && !hasStreamingReply && (
          <ChatSendingStatus
            phase={waitPhase}
            serverStatus={serverStatus}
            onRetry={retryInFlightOrFailed}
            onCancel={() => cancelInFlightSend({ restoreDraft: true })}
          />
        )}
        {hasStreamingReply && waitPhase === 'slow' && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-border-default bg-app/50 px-3 py-2">
              <p className="text-[11px] text-fg-subtle">
                {hasStreamingTokens
                  ? 'Reply is taking longer than usual — you can keep waiting or retry.'
                  : serverStatus?.phase === 'looking_up'
                    ? 'Still checking your transactions — you can keep waiting or retry.'
                    : 'Still waiting for the first words — you can keep waiting or retry.'}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={retryInFlightOrFailed}
                  className="text-xs font-semibold text-brand-soft hover:underline"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => cancelInFlightSend({ restoreDraft: true })}
                  className="text-xs font-medium text-fg-muted hover:text-fg hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" className="h-px w-full shrink-0" />
      </div>

      {showJumpToLatest && (
        <div className="relative z-10 -mt-10 mb-2 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => {
              stickToBottomRef.current = true
              setShowJumpToLatest(false)
              scrollMessagesToBottom('smooth')
            }}
            className="pointer-events-auto rounded-full border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-fg shadow-lg transition hover:bg-surface-elevated"
          >
            Jump to latest
          </button>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className={
          isModalLayout
            ? 'flex shrink-0 flex-col gap-2 border-t border-border-default bg-app pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
            : 'flex flex-col gap-2'
        }
      >
        <label htmlFor="soverm-chat-input" className="sr-only">
          Message to Soverm
        </label>
        {isModalLayout ? (
          <div className="flex w-full items-end gap-2 rounded-xl border border-border-default bg-surface p-1.5 transition focus-within:border-ai/40 focus-within:ring-1 focus-within:ring-ai/20">
            <textarea
              id="soverm-chat-input"
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask about spending, subscriptions, budgets…"
              disabled={isSending}
              data-autofocus="true"
              aria-describedby="soverm-chat-context soverm-chat-limit"
              className={`${inputControlClass} min-w-0 flex-1 resize-none border-0 bg-transparent px-3 focus:border-0 focus:ring-0`}
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ai text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-40"
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
              <ChatBubbleIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-fg-subtle" />
              <textarea
                id="soverm-chat-input"
                ref={inputRef}
                rows={2}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Ask about spending, subscriptions, budgets… (Enter to send, Shift+Enter for new line)"
                disabled={isSending}
                data-autofocus="true"
                aria-describedby="soverm-chat-context soverm-chat-limit"
                className={`${inputControlClass} pl-10 pr-3`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p id="soverm-chat-context" className="text-[11px] leading-relaxed text-fg-subtle">
                  {contextLabel}
                </p>
                {chatLimitLabel ? (
                  <p
                    id="soverm-chat-limit"
                    className={`text-[11px] ${chatNearLimit ? 'font-medium text-warning' : 'text-fg-subtle'}`}
                  >
                    {chatLimitLabel}
                  </p>
                ) : (
                  <span id="soverm-chat-limit" className="sr-only" />
                )}
              </div>
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                className="min-h-10 shrink-0 rounded-lg bg-ai px-5 py-2 text-sm font-medium text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
        {isModalLayout && (
          <div className="space-y-0.5 text-center">
            <p id="soverm-chat-context" className="text-[11px] leading-relaxed text-fg-subtle">
              {contextLabel}
            </p>
            {chatLimitLabel ? (
              <p
                id="soverm-chat-limit"
                className={`text-[11px] ${chatNearLimit ? 'font-medium text-warning' : 'text-fg-subtle'}`}
              >
                {chatLimitLabel}
              </p>
            ) : (
              <span id="soverm-chat-limit" className="sr-only" />
            )}
          </div>
        )}
        {sendError && (
          <div
            className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-center"
            role="alert"
          >
            <p className="text-xs text-danger">{sendError}</p>
            <div className="mt-1 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSendError(null)
                  retryInFlightOrFailed()
                }}
                className="text-xs font-semibold text-brand-soft hover:underline"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setSendError(null)}
                className="text-xs font-medium text-fg-muted hover:text-fg hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  )
}

export default ChatPanel
