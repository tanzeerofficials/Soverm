import { chatQueryKey } from './queryKeys.js'

async function getAuthToken(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('You must be signed in to use chat')
  }
  return token
}

export async function fetchChatMessages(getToken, insightId) {
  const token = await getAuthToken(getToken)
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/chat/${insightId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to load chat: ${response.status}`)
  }

  const data = await response.json()
  return data.messages ?? []
}

export async function sendChatMessage(getToken, insightId, message) {
  const token = await getAuthToken(getToken)
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/chat/${insightId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send message')
  }

  return data.reply
}

export async function sendChatMessageAndRefresh(
  queryClient,
  getToken,
  insightId,
  message
) {
  const trimmed = message.trim()
  const userMessage = {
    role: 'user',
    content: trimmed,
    created_at: new Date().toISOString(),
  }

  await queryClient.cancelQueries({ queryKey: chatQueryKey(insightId) })

  queryClient.setQueryData(chatQueryKey(insightId), (old) => [
    ...(old ?? []),
    userMessage,
  ])

  try {
    const reply = await sendChatMessage(getToken, insightId, trimmed)
    const assistantMessage = {
      role: 'assistant',
      content: reply,
      created_at: new Date().toISOString(),
    }

    queryClient.setQueryData(chatQueryKey(insightId), (old) => [
      ...(old ?? []),
      assistantMessage,
    ])
  } catch (err) {
    queryClient.setQueryData(chatQueryKey(insightId), (old) => {
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
    throw err
  }
}
