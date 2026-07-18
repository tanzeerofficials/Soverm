import { chatQueryKey, chatLimitsQueryKey, GENERAL_CHAT_KEY } from './queryKeys.js'
import { captureClientError } from './sentry.js'
import { classifyChatNetworkError } from './chatWaitStatus.js'

async function getAuthToken(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('You must be signed in to use chat')
  }
  return token
}

function chatApiPath(threadId) {
  return threadId === GENERAL_CHAT_KEY
    ? `${import.meta.env.VITE_API_URL}/api/chat/general`
    : `${import.meta.env.VITE_API_URL}/api/chat/${threadId}`
}

/*
 * What this does: loads messages for either a weekly insight thread or the
 * shared "general" thread (no insight required).
 *
 * Why: Ask Soverm should work before the user generates their first insight.
 */
export async function fetchChatMessages(getToken, threadId) {
  const token = await getAuthToken(getToken)
  const response = await fetch(chatApiPath(threadId), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to load chat: ${response.status}`)
  }

  const data = await response.json()
  return data.messages ?? []
}

async function parseJsonError(response) {
  let data = {}
  try {
    data = await response.json()
  } catch {
    /* Non-JSON bodies still need a clear error. */
  }

  if (data.error === 'rate_limit_exceeded') {
    const err = new Error(
      data.message || 'Message limit reached. Try again later.'
    )
    err.code = 'rate_limit_exceeded'
    err.chatLimit = {
      remaining: data.remaining ?? 0,
      limit: data.limit,
      count: data.count,
      allowed: false,
      period: data.period ?? 'hour',
      retryAfterSeconds: data.retryAfterSeconds ?? null,
    }
    throw err
  }
  throw new Error(
    data.message || data.error || `Failed to send message (${response.status})`
  )
}

function rethrowAsChatError(err) {
  if (err?.name === 'AbortError') {
    const abortError = new Error(classifyChatNetworkError(err))
    abortError.name = 'AbortError'
    abortError.cause = err
    throw abortError
  }

  const friendly = new Error(classifyChatNetworkError(err))
  friendly.cause = err
  throw friendly
}

/*
 * What this does: POSTs a chat message and reads Server-Sent Events as Claude
 * generates tokens. Calls onDelta(fullTextSoFar) so the UI can show a growing bubble.
 * onStatus({ phase, title, detail }) covers research pauses so the UI can
 * show "Researching…" instead of looking frozen.
 *
 * Why: waiting for the full reply makes long answers feel broken on mobile.
 * signal: optional AbortSignal so the UI can cancel a hung/slow request.
 */
export async function sendChatMessageStreaming(
  getToken,
  threadId,
  message,
  { onDelta, onStatus, signal } = {}
) {
  const token = await getAuthToken(getToken)

  let response
  try {
    response = await fetch(`${chatApiPath(threadId)}?stream=1`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ message }),
      signal,
    })
  } catch (err) {
    rethrowAsChatError(err)
  }

  if (!response.ok) {
    await parseJsonError(response)
  }

  if (!response.body) {
    throw new Error('Streaming is not supported in this browser')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalReply = ''
  let chatLimit = null

  const abortReader = () => {
    reader.cancel().catch(() => {})
  }
  signal?.addEventListener('abort', abortReader, { once: true })

  try {
    while (true) {
      let chunk
      try {
        chunk = await reader.read()
      } catch (err) {
        rethrowAsChatError(err)
      }

      const { done, value } = chunk
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part
          .split('\n')
          .find((entry) => entry.startsWith('data: '))
        if (!line) {
          continue
        }

        let payload
        try {
          payload = JSON.parse(line.slice(6))
        } catch {
          continue
        }

        if (payload.type === 'status') {
          onStatus?.({
            phase: payload.phase || 'thinking',
            title: payload.title || null,
            detail: payload.detail || null,
          })
        } else if (payload.type === 'delta' && typeof payload.text === 'string') {
          finalReply = payload.text
          onDelta?.(finalReply)
        } else if (payload.type === 'done' && typeof payload.reply === 'string') {
          finalReply = payload.reply
          chatLimit = payload.chatLimit ?? null
          onDelta?.(finalReply)
        } else if (payload.type === 'error') {
          throw new Error(payload.message || 'Failed to send message')
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', abortReader)
  }

  if (signal?.aborted) {
    rethrowAsChatError(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
  }

  if (!finalReply) {
    throw new Error('Chat stream ended without a reply')
  }

  return { reply: finalReply, chatLimit }
}

export async function sendChatMessageAndRefresh(
  queryClient,
  getToken,
  threadId,
  message,
  { signal } = {}
) {
  const trimmed = message.trim()
  const userMessage = {
    role: 'user',
    content: trimmed,
    created_at: new Date().toISOString(),
  }
  const assistantPlaceholder = {
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
    streaming: true,
    statusPhase: 'thinking',
    statusTitle: 'Thinking…',
    statusDetail: null,
  }

  await queryClient.cancelQueries({ queryKey: chatQueryKey(threadId) })

  queryClient.setQueryData(chatQueryKey(threadId), (old) => [
    ...(old ?? []),
    userMessage,
    assistantPlaceholder,
  ])

  function patchStreamingAssistant(patch) {
    queryClient.setQueryData(chatQueryKey(threadId), (old) => {
      const messages = [...(old ?? [])]
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        messages[messages.length - 1] = {
          ...last,
          ...patch,
        }
      }
      return messages
    })
  }

  try {
    const { reply, chatLimit } = await sendChatMessageStreaming(
      getToken,
      threadId,
      trimmed,
      {
        signal,
        onStatus: (status) => {
          patchStreamingAssistant({
            statusPhase: status.phase || 'thinking',
            statusTitle: status.title || null,
            statusDetail: status.detail || null,
          })
        },
        onDelta: (fullText) => {
          patchStreamingAssistant({
            content: fullText,
            statusPhase: 'writing',
            statusTitle: 'Generating…',
            statusDetail: null,
          })
        },
      }
    )

    queryClient.setQueryData(chatQueryKey(threadId), (old) => {
      const messages = [...(old ?? [])]
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        messages[messages.length - 1] = {
          role: 'assistant',
          content: reply,
          created_at: last.created_at,
        }
      }
      return messages
    })

    if (chatLimit) {
      queryClient.setQueryData(chatLimitsQueryKey, chatLimit)
    } else {
      queryClient.invalidateQueries({ queryKey: chatLimitsQueryKey })
    }

    return reply
  } catch (err) {
    queryClient.setQueryData(chatQueryKey(threadId), (old) => {
      const messages = old ?? []
      const withoutStreaming = messages.filter(
        (entry) => !(entry.role === 'assistant' && entry.streaming)
      )
      const last = withoutStreaming[withoutStreaming.length - 1]
      if (
        last?.role === 'user' &&
        last.content === trimmed &&
        last.created_at === userMessage.created_at
      ) {
        return withoutStreaming.slice(0, -1)
      }
      return withoutStreaming
    })

    if (err?.name !== 'AbortError') {
      captureClientError(err, { label: 'send_chat_message' })
    }
    if (err?.chatLimit) {
      queryClient.setQueryData(chatLimitsQueryKey, err.chatLimit)
    }
    throw err
  }
}
