/*
 * CHAT WAIT / NETWORK STATUS
 *
 * Shared copy + helpers so slow replies show clear "still working"
 * and tool-lookup states instead of a frozen spinner or false
 * "connection may be slow" alarms while the server is actually busy.
 */

/** After this, reassure the user the request is still alive. */
export const CHAT_STILL_WORKING_MS = 4_000

/**
 * Total elapsed with no server activity tracking → offer retry.
 * Used when the client has not received status/token updates.
 */
export const CHAT_SLOW_MS = 12_000

/**
 * No status/token updates for this long while a work phase is active
 * → treat as stalled and offer retry. Longer than CHAT_SLOW_MS because
 * loading finances / Claude turns routinely take 12–20s of real work.
 */
export const CHAT_STALL_MS = 25_000

/** Hard abort so a hung request cannot block the composer forever. */
export const CHAT_HARD_TIMEOUT_MS = 90_000

const WORK_PHASES = new Set(['thinking', 'looking_up', 'writing'])

/**
 * @param {number} elapsedMs
 * @param {{
 *   hasTokens?: boolean,
 *   activity?: string | null,
 *   msSinceActivity?: number | null,
 * }} [options]
 * @returns {'thinking' | 'looking_up' | 'writing' | 'still' | 'slow'}
 */
export function getChatWaitPhase(
  elapsedMs,
  { hasTokens = false, activity = null, msSinceActivity = null } = {}
) {
  const idleMs = Number.isFinite(msSinceActivity) ? msSinceActivity : elapsedMs
  const isWorkActivity = WORK_PHASES.has(activity)

  if (hasTokens || activity === 'writing') {
    /*
     * Tokens already flowing — only escalate if the stream goes quiet.
     * Do not flip to "slow" just because total elapsed is high.
     */
    if (hasTokens && idleMs >= CHAT_STALL_MS) {
      return 'slow'
    }
    return 'writing'
  }

  if (activity === 'looking_up') {
    return idleMs >= CHAT_STALL_MS ? 'slow' : 'looking_up'
  }

  if (activity === 'thinking' || isWorkActivity) {
    if (idleMs >= CHAT_STALL_MS) {
      return 'slow'
    }
    if (elapsedMs >= CHAT_STILL_WORKING_MS) {
      return 'still'
    }
    return 'thinking'
  }

  if (idleMs >= CHAT_SLOW_MS) {
    return 'slow'
  }

  if (elapsedMs >= CHAT_STILL_WORKING_MS) {
    return 'still'
  }

  return 'thinking'
}

export function getChatWaitCopy(phase, serverStatus = null) {
  /*
   * Prefer live server work copy whenever we have it. Even on "slow", keep
   * the work title so we never imply the connection is broken while Soverm
   * is loading finances / looking up / thinking.
   */
  if (serverStatus?.title) {
    if (phase === 'slow') {
      return {
        title: serverStatus.title,
        detail: 'Still working on this — you can keep waiting or retry.',
      }
    }

    if (
      phase === 'looking_up' ||
      phase === 'still' ||
      phase === 'thinking' ||
      phase === serverStatus.phase ||
      WORK_PHASES.has(serverStatus.phase)
    ) {
      return {
        title: serverStatus.title,
        detail:
          serverStatus.detail ??
          (serverStatus.phase === 'looking_up'
            ? 'Pulling a few details so the answer stays accurate.'
            : null),
      }
    }
  }

  switch (phase) {
    case 'looking_up':
      return {
        title: 'Checking your transactions…',
        detail: 'Pulling a few details so the answer stays accurate.',
      }
    case 'slow':
      return {
        title: 'Still working on your answer…',
        detail: 'You can keep waiting or retry.',
      }
    case 'still':
      return {
        title: 'Still working…',
        detail: 'Pulling your finances together.',
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
