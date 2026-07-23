/*
 * Download the monthly snapshot CSV from the API.
 */

import { authHeaders } from './apiRequest.js'

export async function downloadMonthlySnapshotCsv(getToken, { month } = {}) {
  const token = await getToken()
  const params = new URLSearchParams({ format: 'csv' })
  if (month) {
    params.set('month', month)
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/export/monthly-snapshot?${params}`,
    {
      headers: authHeaders(token),
    }
  )

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || 'soverm-monthly-snapshot.csv'

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
