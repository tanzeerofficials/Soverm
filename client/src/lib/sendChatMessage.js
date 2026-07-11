import { chatQueryKey, GENERAL_CHAT_KEY } from './queryKeys.js'
import { captureClientError } from './sentry.js'

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

export async function sendChatMessage(getToken, threadId, message) {
  const token = await getAuthToken(getToken)
  const response = await fetch(chatApiPath(threadId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  const data = await response.json()

  if (!response.ok) {
    if (data.error === 'rate_limit_exceeded' && data.message) {
      throw new Error(data.message)
    }
    throw new Error(data.message || data.error || 'Failed to send message')
  }

  return data.reply
}

export async function sendChatMessageAndRefresh(
  queryClient,
  getToken,
  threadId,
  message
) {
  const trimmed = message.trim()
  const userMessage = {
    role: 'user',
    content: trimmed,
    created_at: new Date().toISOString(),
  }

  await queryClient.cancelQueries({ queryKey: chatQueryKey(threadId) })

  queryClient.setQueryData(chatQueryKey(threadId), (old) => [
    ...(old ?? []),
    userMessage,
  ])

  try {
    const reply = await sendChatMessage(getToken, threadId, trimmed)
    const assistantMessage = {
      role: 'assistant',
      content: reply,
      created_at: new Date().toISOString(),
    }

    queryClient.setQueryData(chatQueryKey(threadId), (old) => [
      ...(old ?? []),
      assistantMessage,
    ])
  } catch (err) {
    queryClient.setQueryData(chatQueryKey(threadId), (old) => {
      const messages = old ?? []
      const last = messages[messages.length - 1]
      if (
        last?.role === 'user' &&
        last.content === trimmed &&
        last.created_at === userMessage.created_at
      ) {
        return messages.slice(0, -1)
      }
      return messages
    })
    captureClientError(err, { label: 'send_chat_message' })
    throw err
  }
}
