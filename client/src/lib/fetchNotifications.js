import { authHeaders } from './apiRequest.js'

async function getAuthToken(getToken) {
  const token = await getToken()
  if (!token) {
    throw new Error('You must be signed in')
  }
  return token
}

export async function fetchNotifications(getToken, { unreadOnly = false } = {}) {
  const token = await getAuthToken(getToken)
  const params = unreadOnly ? '?unreadOnly=true' : ''
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notifications${params}`,
    {
      headers: authHeaders(token),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to load notifications: ${response.status}`)
  }

  return response.json()
}

export async function markNotificationRead(getToken, notificationId) {
  const token = await getAuthToken(getToken)
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notifications/${notificationId}/read`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to mark notification read: ${response.status}`)
  }

  return response.json()
}

export async function markAllNotificationsRead(getToken) {
  const token = await getAuthToken(getToken)
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notifications/read-all`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to mark all notifications read: ${response.status}`)
  }

  return response.json()
}

export async function updateNotificationPreferences(getToken, { proactiveEnabled }) {
  const token = await getAuthToken(getToken)
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/notifications/preferences`,
    {
      method: 'PATCH',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ proactiveEnabled }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to update notification preferences: ${response.status}`)
  }

  return response.json()
}
