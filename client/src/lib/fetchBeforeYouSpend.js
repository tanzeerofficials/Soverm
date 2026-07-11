export async function checkBeforeYouSpend(getToken, { amount, category }) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/before-you-spend`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      category: category || undefined,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Before-you-spend failed: ${res.status}`)
  }

  return data
}
