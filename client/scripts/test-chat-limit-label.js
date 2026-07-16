/*
 * Verifies Ask Soverm limit label copy for daily vs hourly windows.
 *
 * Usage: node scripts/test-chat-limit-label.js
 */

import { formatChatLimitLabel } from '../src/lib/fetchChatLimits.js'

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`)
  }
}

try {
  console.log('Chat limit label tests\n')

  assertEqual(
    formatChatLimitLabel({ remaining: 3, limit: 5, period: 'day' }),
    '3 of 5 messages left today',
    'free daily label'
  )
  assertEqual(
    formatChatLimitLabel({ remaining: 17, limit: 20, period: 'hour' }),
    '17 of 20 messages left this hour',
    'pro hourly label'
  )
  assertEqual(formatChatLimitLabel({ remaining: 0, limit: 0 }), null, 'invalid limit')

  console.log('  pass: daily and hourly labels')
  console.log('\nAll chat limit label checks passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
