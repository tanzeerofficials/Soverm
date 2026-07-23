import { chatLimitsQueryKey } from './queryKeys.js'
import { authHeaders } from './apiRequest.js'

/*
 * What this does: loads how many Ask Soverm messages the user has left
 * (5/day on Free, 20/hour on Pro) so the chat UI can show "3 of 5 left today".
 */
export async function fetchChatLimits(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('You must be signed in to check chat limits')
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/limits`, {
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Failed to load chat limits: ${response.status}`)
  }

  return response.json()
}

export function formatChatLimitLabel({ remaining, limit, period = 'hour' } = {}) {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) {
    return null
  }
  const left = Math.max(0, remaining)
  const windowLabel = period === 'day' ? 'today' : 'this hour'
  return `${left} of ${limit} messages left ${windowLabel}`
}

export async function invalidateChatLimits(queryClient) {
  await queryClient.invalidateQueries({ queryKey: chatLimitsQueryKey })
}
