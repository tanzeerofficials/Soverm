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
import { test } from 'node:test'

test('chat wait status', () => {
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
    'thinking with recent activity stays on work phases'
  )

  const lookupCopy = getChatWaitCopy('looking_up', {
    phase: 'looking_up',
    title: 'Researching…',
    detail: 'Looking up Netflix',
  })
  assert.equal(lookupCopy.title, 'Researching…')
  assert.match(lookupCopy.detail, /Netflix/)

  const thinkingCopy = getChatWaitCopy('thinking', {
    phase: 'thinking',
    title: 'Thinking…',
    detail: null,
  })
  assert.equal(thinkingCopy.title, 'Thinking…')
  assert.doesNotMatch(thinkingCopy.title, /financ/i)
  assert.doesNotMatch(thinkingCopy.title, /longer than usual/i)

  const generatingCopy = getChatWaitCopy('writing')
  assert.equal(generatingCopy.title, 'Generating…')

  const slowDefault = getChatWaitCopy('slow')
  assert.doesNotMatch(slowDefault.title, /longer than usual/i)
  assert.doesNotMatch(String(slowDefault.detail || ''), /connection may be slow/i)
  assert.doesNotMatch(slowDefault.title, /financ/i)

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
})
