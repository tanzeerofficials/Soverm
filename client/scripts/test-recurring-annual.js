/*
 * Verifies annual recurring = monthly × 12.
 *
 * Usage: node scripts/test-recurring-annual.js
 */

import { annualizeRecurringMonthly } from '../src/lib/recurringAnnual.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Recurring annual tests\n')

  assert(annualizeRecurringMonthly(89.4) === 1072.8, 'SparkFun $89.40/mo → $1,072.80/year')
  console.log('  pass: SparkFun annualization')
  passed++

  assert(annualizeRecurringMonthly(10.99) === 131.88, '10.99/mo → 131.88/year')
  assert(annualizeRecurringMonthly(0) === 0, 'Zero monthly → zero annual')
  assert(annualizeRecurringMonthly(-5) === 0, 'Negative monthly → zero annual')
  console.log('  pass: edge cases')
  passed++

  console.log(`\n${passed}/${passed} recurring annual tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
