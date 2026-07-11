/**
 * Unit checks for spend-intent extraction and soverm-plan parsing.
 *
 * Usage: node scripts/test-chat-enhancements.js
 */

import { extractSpendIntent } from '../utils/extractSpendIntent.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('chat enhancement tests\n')

assert(
  extractSpendIntent('Can I afford $40 on dinner?')?.amount === 40,
  'afford $40 dinner'
)
assert(
  extractSpendIntent('Can I afford $40 on dinner?')?.category === 'Food and Drink',
  'dinner maps to food category'
)
assert(
  extractSpendIntent('Should I spend 25 dollars on uber?')?.amount === 25,
  '25 dollars uber'
)
assert(
  extractSpendIntent('How many subscriptions do I have?') === null,
  'ignores non-spend questions'
)
assert(
  extractSpendIntent('What is 40?') === null,
  'ignores bare numbers without spend cue'
)

console.log('All chat enhancement tests passed.')
