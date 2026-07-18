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
  CHAT_STALL_MS,
} from '../../client/src/lib/chatWaitStatus.js'

assert.equal(getChatWaitPhase(0), 'thinking')
assert.equal(getChatWaitPhase(1000, { hasTokens: true }), 'writing')
assert.equal(getChatWaitPhase(CHAT_STILL_WORKING_MS + 100), 'still')
assert.equal(getChatWaitPhase(CHAT_SLOW_MS + 100), 'slow')
assert.equal(
  getChatWaitPhase(2_000, { activity: 'looking_up' }),
  'looking_up',
  'tool lookup should show looking_up before stall threshold'
)
assert.equal(
  getChatWaitPhase(CHAT_SLOW_MS + 100, {
    activity: 'looking_up',
    msSinceActivity: 2_000,
  }),
  'looking_up',
  'recent lookup activity must not alarm as slow just because total elapsed is high'
)
assert.equal(
  getChatWaitPhase(CHAT_STALL_MS + 100, {
    activity: 'looking_up',
    msSinceActivity: CHAT_STALL_MS + 100,
  }),
  'slow',
  'quiet lookups still escalate so Retry appears'
)
assert.equal(
  getChatWaitPhase(CHAT_SLOW_MS + 100, {
    activity: 'thinking',
    msSinceActivity: 3_000,
  }),
  'still',
  'loading/thinking with recent activity stays on work phases'
)

const lookupCopy = getChatWaitCopy('looking_up', {
  phase: 'looking_up',
  title: 'Checking your transactions…',
  detail: 'Reviewing Food and Drink charges',
})
assert.equal(lookupCopy.title, 'Checking your transactions…')
assert.match(lookupCopy.detail, /Food and Drink/)

const loadingCopy = getChatWaitCopy('still', {
  phase: 'thinking',
  title: 'Loading your finances…',
  detail: 'Pulling subscriptions, categories, and recent activity.',
})
assert.equal(loadingCopy.title, 'Loading your finances…')
assert.doesNotMatch(loadingCopy.title, /longer than usual/i)
assert.doesNotMatch(String(loadingCopy.detail || ''), /connection may be slow/i)

const slowWithWork = getChatWaitCopy('slow', {
  phase: 'thinking',
  title: 'Loading your finances…',
  detail: 'Pulling subscriptions, categories, and recent activity.',
})
assert.equal(slowWithWork.title, 'Loading your finances…')
assert.doesNotMatch(slowWithWork.title, /longer than usual/i)
assert.doesNotMatch(String(slowWithWork.detail || ''), /connection may be slow/i)

const slowDefault = getChatWaitCopy('slow')
assert.doesNotMatch(slowDefault.title, /longer than usual/i)
assert.doesNotMatch(String(slowDefault.detail || ''), /connection may be slow/i)

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
