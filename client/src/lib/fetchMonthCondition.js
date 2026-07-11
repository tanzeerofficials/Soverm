export async function fetchMonthCondition(getToken, monthKey = null) {
  const token = await getToken()
  const params = new URLSearchParams()
  if (monthKey) {
    params.set('month', monthKey)
  }
  const query = params.toString()
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/api/month-condition${query ? `?${query}` : ''}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Month condition fetch failed: ${res.status}`)
  }

  return res.json()
}
