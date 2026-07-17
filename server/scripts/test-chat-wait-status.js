/**
 * Offline unit checks for chat wait / network copy helpers.
 *
 * Usage: node scripts/test-chat-wait-status.js
 */

import assert from 'node:assert/strict'
import {
  getChatWaitCopy,
  getChatWaitPhase,
  classifyChatNetworkError,
  CHAT_STILL_WORKING_MS,
  CHAT_SLOW_MS,
} from '../../client/src/lib/chatWaitStatus.js'

assert.equal(getChatWaitPhase(0), 'thinking')
assert.equal(getChatWaitPhase(1000, { hasTokens: true }), 'writing')
assert.equal(getChatWaitPhase(CHAT_STILL_WORKING_MS + 100), 'still')
assert.equal(getChatWaitPhase(CHAT_SLOW_MS + 100), 'slow')
assert.equal(
  getChatWaitPhase(2_000, { activity: 'looking_up' }),
  'looking_up',
  'tool lookup should show looking_up before slow threshold'
)
assert.equal(
  getChatWaitPhase(CHAT_SLOW_MS + 100, { activity: 'looking_up' }),
  'slow',
  'long lookups still escalate so Retry appears'
)

const lookupCopy = getChatWaitCopy('looking_up', {
  phase: 'looking_up',
  title: 'Checking your transactions…',
  detail: 'Reviewing Food and Drink charges',
})
assert.equal(lookupCopy.title, 'Checking your transactions…')
assert.match(lookupCopy.detail, /Food and Drink/)

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

console.log('chatWaitStatus tests passed.')
