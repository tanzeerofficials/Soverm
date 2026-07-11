/**
 * Offline unit checks for chat wait / network copy helpers.
 *
 * Usage: node --experimental-vm-modules  (or plain node if package type module)
 * From client: node --input-type=module won't resolve easily — mirror under server
 * or run via vite-node. Kept as a tiny pure copy for CI in server scripts.
 */

import assert from 'node:assert/strict'

const CHAT_STILL_WORKING_MS = 4_000
const CHAT_SLOW_MS = 12_000

function getChatWaitPhase(elapsedMs, { hasTokens = false } = {}) {
  if (elapsedMs >= CHAT_SLOW_MS) return 'slow'
  if (elapsedMs >= CHAT_STILL_WORKING_MS) return 'still'
  return hasTokens ? 'writing' : 'thinking'
}

function classifyChatNetworkError(err, { timedOut = false } = {}) {
  if (timedOut) {
    return 'That took too long. Check your connection and retry.'
  }
  const name = err?.name || ''
  const message = String(err?.message || '')
  if (name === 'AbortError' || /aborted|abort/i.test(message)) {
    return 'Request cancelled.'
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return "Couldn't reach Soverm. Check your connection and retry."
  }
  if (/stream ended without a reply/i.test(message)) {
    return 'The reply got cut off. Retry to get a full answer.'
  }
  return message || "Couldn't send that message. Try again."
}

assert.equal(getChatWaitPhase(0), 'thinking')
assert.equal(getChatWaitPhase(1000, { hasTokens: true }), 'writing')
assert.equal(getChatWaitPhase(5_000), 'still')
assert.equal(getChatWaitPhase(15_000), 'slow')
assert.match(
  classifyChatNetworkError(new Error('Failed to fetch')),
  /Couldn't reach Soverm/
)
assert.match(
  classifyChatNetworkError(new Error('x'), { timedOut: true }),
  /took too long/
)
assert.equal(
  classifyChatNetworkError(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
  'Request cancelled.'
)

console.log('chatWaitStatus mirror tests passed.')
