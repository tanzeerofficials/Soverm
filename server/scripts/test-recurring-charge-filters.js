/*
 * Verifies recurring charge exclusion filters.
 *
 * Usage: node scripts/test-recurring-charge-filters.js
 */

import {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
  isNoisyRecurringCategory,
  merchantSuggestsSubscription,
  resolveSubscriptionMerchantKeyword,
} from '../utils/recurringChargeFilters.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Recurring charge filter tests\n')

  assert(
    isExcludedFromRecurringDetection({
      name: 'CREDIT CARD 3333 PAYMENT *//',
      category: 'Payment',
    }),
    'Credit card payment excluded'
  )
  assert(
    isExcludedFromRecurringDetection({
      name: 'ACH TRANSFER OUT',
      category: 'Transfer',
    }),
    'Transfer excluded'
  )
  assert(
    isExcludedFromRecurringDetection({
      name: 'ATM WITHDRAWAL',
      category: 'Bank Fees',
    }),
    'ATM withdrawal excluded'
  )
  assert(
    !isExcludedFromRecurringDetection({
      name: 'SPARKFUN ELECTRONICS',
      category: 'Shops',
    }),
    'SparkFun should not be excluded upfront'
  )
  console.log('  pass: blocklist exclusions')
  passed++

  assert(isNoisyRecurringCategory('Food and Drink'), 'Food and Drink is noisy')
  assert(isNoisyRecurringCategory(null), 'NULL category is noisy')
  assert(isCoincidentalMerchantName('UBER TRIP'), 'Uber is coincidental')
  assert(!isNoisyRecurringCategory('Software'), 'Software is not noisy')
  console.log('  pass: noisy category classification')
  passed++

  assert(merchantSuggestsSubscription('NETFLIX.COM'), 'Netflix keyword')
  assert(merchantSuggestsSubscription('PLANET FITNESS MEMBERSHIP'), 'Gym keyword')
  assert(merchantSuggestsSubscription('REPLIT INC'), 'Replit keyword')
  assert(merchantSuggestsSubscription('ANTHROPIC'), 'Anthropic keyword')
  assert(merchantSuggestsSubscription('CLAUDE.AI SUBSCRIPTION'), 'Claude keyword')
  assert(
    resolveSubscriptionMerchantKeyword('CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA') ===
      'claude',
    'Claude subscription still resolves as subscription keyword'
  )
  assert(!merchantSuggestsSubscription("McDonald's"), 'McDonald\'s not a subscription keyword')
  console.log('  pass: subscription merchant keywords')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
