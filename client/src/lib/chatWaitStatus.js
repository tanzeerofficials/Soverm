/*
 * CHAT WAIT / NETWORK STATUS
 *
 * Shared copy + helpers so slow connections show clear "still thinking"
 * and retry states instead of a frozen spinner.
 */

/** After this, reassure the user the request is still alive. */
export const CHAT_STILL_WORKING_MS = 4_000

/** After this, offer retry — the connection may be stuck. */
export const CHAT_SLOW_MS = 12_000

/** Hard abort so a hung request cannot block the composer forever. */
export const CHAT_HARD_TIMEOUT_MS = 90_000

/**
 * @param {number} elapsedMs
 * @param {{ hasTokens?: boolean }} [options]
 * @returns {'thinking' | 'writing' | 'still' | 'slow'}
 */
export function getChatWaitPhase(elapsedMs, { hasTokens = false } = {}) {
  if (elapsedMs >= CHAT_SLOW_MS) {
    return 'slow'
  }
  if (elapsedMs >= CHAT_STILL_WORKING_MS) {
    return 'still'
  }
  return hasTokens ? 'writing' : 'thinking'
}

export function getChatWaitCopy(phase) {
  switch (phase) {
    case 'slow':
      return {
        title: 'Taking longer than usual…',
        detail: 'Your connection may be slow. You can keep waiting or retry.',
      }
    case 'still':
      return {
        title: 'Still working…',
        detail: 'This can take a moment on a slow connection.',
      }
    case 'writing':
      return {
        title: 'Soverm is writing…',
        detail: null,
      }
    case 'thinking':
    default:
      return {
        title: 'Soverm is thinking…',
        detail: null,
      }
  }
}

/**
 * Turn raw fetch/stream failures into short, actionable copy.
 */
export function classifyChatNetworkError(err, { timedOut = false } = {}) {
  if (timedOut) {
    return 'That took too long. Check your connection and retry.'
  }

  const name = err?.name || ''
  const message = String(err?.message || '')

  if (name === 'AbortError' || /aborted|abort/i.test(message)) {
    return 'Request cancelled.'
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    return "Looks like you're offline. Reconnect and retry."
  }

  if (
    /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(
      message
    )
  ) {
    return "Couldn't reach Soverm. Check your connection and retry."
  }

  if (/stream ended without a reply/i.test(message)) {
    return 'The reply got cut off. Retry to get a full answer.'
  }

  return message || "Couldn't send that message. Try again."
}
