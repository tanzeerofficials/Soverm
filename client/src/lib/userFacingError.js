/*
 * User-facing error copy for toasts and inline errors.
 *
 * What this does: picks a calm message for the UI.
 * Why: raw fetch failures say "Failed to fetch" — jargon for paycheck-to-paycheck users.
 * How: keep API/server messages that already read as English; otherwise use the fallback.
 */

const NETWORK_JARGON =
  /failed to fetch|networkerror|network request failed|load failed|fetch failed|aborterror|unexpected token|json\.parse|typeerror/i

/** Our own fetch helpers often append ": 500" or "(503)" — not useful in a toast. */
const STATUS_CODE_TAIL = /failed:\s*\d{3}\b|\(\d{3}\)\s*$/i

/**
 * @param {unknown} err
 * @param {string} fallback — calm default when the raw message is jargon or missing
 * @returns {string}
 */
export function toUserFacingErrorMessage(err, fallback) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "Looks like you're offline. Check your connection and try again."
  }

  const raw =
    typeof err === 'string'
      ? err
      : typeof err?.message === 'string'
        ? err.message
        : ''

  const message = raw.trim()
  if (!message) {
    return fallback
  }

  if (NETWORK_JARGON.test(message) || STATUS_CODE_TAIL.test(message)) {
    return fallback
  }

  return message
}
