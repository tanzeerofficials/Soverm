export const FIRST_CONNECT_FLAG = 'soverm:celebrate-first-connect'
export const FIRST_CONNECT_META = 'soverm:first-connect-meta'

export function markFirstConnectCelebration({ accountsConnected = 1, syncedAdded = 0 } = {}) {
  try {
    sessionStorage.setItem(FIRST_CONNECT_FLAG, '1')
    sessionStorage.setItem(
      FIRST_CONNECT_META,
      JSON.stringify({ accountsConnected, syncedAdded })
    )
  } catch {
    // sessionStorage unavailable — skip celebration flag
  }
}

export function consumeFirstConnectCelebration() {
  try {
    if (sessionStorage.getItem(FIRST_CONNECT_FLAG) !== '1') {
      return null
    }

    sessionStorage.removeItem(FIRST_CONNECT_FLAG)

    const raw = sessionStorage.getItem(FIRST_CONNECT_META)
    sessionStorage.removeItem(FIRST_CONNECT_META)

    if (!raw) {
      return { accountsConnected: 1, syncedAdded: 0 }
    }

    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getCachedAccountCount(queryClient) {
  const entries = queryClient.getQueriesData({ queryKey: ['dashboard'] })
  let max = 0

  for (const [, data] of entries) {
    max = Math.max(max, data?.accounts?.length ?? 0)
  }

  return max
}

export { getCachedAccountCount }
