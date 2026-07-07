export async function fetchTrackers(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trackers`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Tracker fetch failed: ${res.status}`)
  }

  return res.json()
}

export async function createTracker(getToken, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trackers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Tracker create failed: ${res.status}`)
  }

  return res.json()
}

export async function updateTracker(getToken, trackerId, payload) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trackers/${trackerId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Tracker update failed: ${res.status}`)
  }

  return res.json()
}

export async function deleteTracker(getToken, trackerId) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trackers/${trackerId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Tracker delete failed: ${res.status}`)
  }

  return res.json()
}
