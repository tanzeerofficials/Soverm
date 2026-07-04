/*
 * Verifies recurring charge detection filters and false-positive guards.
 *
 * Usage: node scripts/test-recurring-charges.js
 */

import { normalizeMerchantName } from '../utils/merchantNormalize.js'
import {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
  isHardExcludedPaymentName,
  isNoisyRecurringCategory,
  matchesExcludedRecurringName,
} from '../utils/recurringChargeFilters.js'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
  detectRecurringChargesFromTransactions,
} from '../utils/expenseAnalyzerData.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, date, category = null, pending = false) {
  return { name, amount, date, category, pending }
}

let passed = 0

try {
  console.log('Recurring charge detection tests\n')

  assert(isHardExcludedPaymentName('CREDIT CARD 3333 PAYMENT *//'), 'Hard payment exclusion')
  assert(
    isExcludedFromRecurringDetection(
      tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-01-05', null)
    ),
    'Credit card payment row excluded before pattern matching'
  )
  assert(isNoisyRecurringCategory(null), 'NULL category treated as noisy/uncategorized')
  assert(isCoincidentalMerchantName("McDonald's"), 'McDonald\'s is coincidental merchant')
  assert(isCoincidentalMerchantName('Uber 072515 SF**POOL**'), 'Uber is coincidental merchant')
  console.log('  pass: payment exclusions and null-category handling')
  passed++

  const spotifyCharges = detectRecurringChargesFromTransactions([
    tx('SPOTIFY USA', 10.99, '2026-01-05'),
    tx('SPOTIFY*PREMIUM', 10.99, '2026-02-04'),
    tx('SPOTIFY', 10.99, '2026-03-06'),
  ])
  assert(spotifyCharges.length === 1, 'Expected one Spotify subscription')
  assert(spotifyCharges[0].occurrenceCount === 3, 'Expected 3 Spotify charges')
  console.log('  pass: keyword subscription still detected with null categories')
  passed++

  const sparkfun = detectRecurringChargesFromTransactions([
    tx('SparkFun', 89.4, '2026-04-10', null),
    tx('SparkFun', 89.4, '2026-05-10', null),
    tx('SparkFun', 89.4, '2026-06-09', null),
  ])
  assert(sparkfun.length === 1, 'SparkFun should still be detected with identical monthly charges')
  assert(sparkfun[0].averageAmount === 89.4, 'SparkFun average amount mismatch')
  assert(sparkfun[0].confidence === 'medium', 'Non-keyword identical fallback is medium confidence')
  console.log('  pass: SparkFun recurring pattern still detected')
  passed++

  const looseGaps = detectRecurringChargesFromTransactions([
    tx('Obscure SaaS Co', 49, '2026-01-01', null),
    tx('Obscure SaaS Co', 49, '2026-02-02', null),
    tx('Obscure SaaS Co', 49, '2026-03-05', null),
  ])
  assert(looseGaps.length === 0, '32-day gaps must fail identical-amount fallback (28-31 only)')
  console.log('  pass: identical-amount fallback requires 28-31 day gaps')
  passed++

  const tightGaps = detectRecurringChargesFromTransactions([
    tx('Obscure SaaS Co', 49, '2026-01-01', null),
    tx('Obscure SaaS Co', 49, '2026-01-29', null),
    tx('Obscure SaaS Co', 49, '2026-02-28', null),
  ])
  assert(tightGaps.length === 1, '28-31 day gaps with identical amounts should pass fallback')
  assert(tightGaps[0].confidence === 'medium', 'Fallback detection is medium confidence')
  console.log('  pass: identical-amount fallback accepts tight monthly spacing')
  passed++

  const creditCardPattern = detectRecurringChargesFromTransactions([
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-04-14', null),
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-05-14', null),
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-06-13', null),
  ])
  assert(creditCardPattern.length === 0, 'Credit card payments must never appear')
  console.log('  pass: credit card payment excluded even with monthly pattern')
  passed++

  const mcdonalds = detectRecurringChargesFromTransactions([
    tx("McDonald's", 12, '2026-04-11', null),
    tx("McDonald's", 12, '2026-05-11', null),
    tx("McDonald's", 12, '2026-06-10', null),
  ])
  assert(mcdonalds.length === 0, 'McDonald\'s must be blocked via merchant denylist')
  console.log('  pass: McDonald\'s false positive blocked')
  passed++

  const uber = detectRecurringChargesFromTransactions([
    tx('Uber 072515 SF**POOL**', 6.33, '2026-04-27', null),
    tx('Uber 072515 SF**POOL**', 6.33, '2026-05-27', null),
    tx('Uber 072515 SF**POOL**', 6.33, '2026-06-26', null),
  ])
  assert(uber.length === 0, 'Uber rides must be blocked via merchant denylist')
  console.log('  pass: Uber false positive blocked')
  passed++

  const starbucks = detectRecurringChargesFromTransactions([
    tx('Starbucks', 4.33, '2026-04-11', null),
    tx('Starbucks', 4.33, '2026-05-11', null),
    tx('Starbucks', 4.33, '2026-06-10', null),
  ])
  assert(starbucks.length === 0, 'Starbucks should be blocked as coincidental merchant')
  console.log('  pass: Starbucks false positive blocked')
  passed++

  const looseAmounts = detectRecurringChargesFromTransactions([
    tx('Some Vendor', 10, '2026-01-05', null),
    tx('Some Vendor', 11, '2026-02-04', null),
    tx('Some Vendor', 10.5, '2026-03-06', null),
  ])
  assert(looseAmounts.length === 0, 'Non-keyword merchants need identical amounts')
  console.log('  pass: non-keyword merchants require identical amounts')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
