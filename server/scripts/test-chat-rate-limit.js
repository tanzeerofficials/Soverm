/*
 * Verifies tier-aware Ask Soverm rate limits (5/day Free, 20/hour Pro).
 *
 * Usage: node scripts/test-chat-rate-limit.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  CHAT_HOURLY_LIMIT,
  FREE_DAILY_CHAT_LIMIT,
} from '../shared/usageLimits.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rateLimitSource = readFileSync(join(__dirname, '../utils/rateLimit.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

try {
  console.log('Chat rate limit tests\n')

  assert(FREE_DAILY_CHAT_LIMIT === 5, 'Free tier chat cap should be 5 messages/day')
  assert(CHAT_HOURLY_LIMIT === 20, 'Pro hourly chat cap should stay at 20/hour')
  assert(
    rateLimitSource.includes('getChatMessagesToday'),
    'rateLimit.js must count user messages for the calendar day'
  )
  assert(
    rateLimitSource.includes("period: 'day'"),
    'rateLimit.js must label free-tier limits as daily'
  )
  assert(
    rateLimitSource.includes('getUserTier'),
    'rateLimit.js must branch on subscription tier'
  )

  console.log('  pass: shared limits and tier-aware rateLimit wiring')
  console.log('\nAll chat rate limit checks passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
