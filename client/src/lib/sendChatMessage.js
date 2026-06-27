import { chatQueryKey } from './queryKeys.js'

export async function fetchChatMessages(getToken, insightId) {
  const token = await getToken()
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
  const token = await getToken()
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
  await sendChatMessage(getToken, insightId, message)
  await queryClient.invalidateQueries({ queryKey: chatQueryKey(insightId) })
}
