import { chatLimitsQueryKey } from './queryKeys.js'

/*
 * What this does: loads how many Ask Soverm messages the user has left
 * this hour (rolling window) so the chat UI can show "17 of 20 left".
 */
export async function fetchChatLimits(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('You must be signed in to check chat limits')
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/limits`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to load chat limits: ${response.status}`)
  }

  return response.json()
}

export function formatChatLimitLabel({ remaining, limit } = {}) {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) {
    return null
  }
  const left = Math.max(0, remaining)
  return `${left} of ${limit} messages left this hour`
}

export async function invalidateChatLimits(queryClient) {
  await queryClient.invalidateQueries({ queryKey: chatLimitsQueryKey })
}
