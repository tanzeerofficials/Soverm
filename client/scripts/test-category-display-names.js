/*
 * Verifies category display names and account attribution formatting.
 *
 * Usage: node scripts/test-category-display-names.js
 */

import { formatCategoryDisplayName } from '../src/lib/categoryDisplayNames.js'
import {
  formatCategoryAccountSources,
  formatRecurringAccountSource,
} from '../src/lib/accountAttribution.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

console.log('Category display + account attribution tests\n')

assert(
  formatCategoryDisplayName('General Merchandise') === 'Shopping',
  'General Merchandise -> Shopping'
)
console.log('  pass: General Merchandise -> Shopping')
passed++

assert(
  formatCategoryDisplayName('Food And Drink') === 'Dining',
  'Food And Drink -> Dining'
)
console.log('  pass: Food And Drink -> Dining')
passed++

assert(
  formatCategoryDisplayName('Loan Payments') === 'Credit Card & Loan Payments',
  'Loan Payments -> Credit Card & Loan Payments'
)
console.log('  pass: Loan Payments mapped')
passed++

assert(
  formatCategoryDisplayName('Custom Plaid Label') === 'Custom Plaid Label',
  'Unknown category title-cased'
)
console.log('  pass: unknown category falls back to title case')
passed++

const singleSource = formatCategoryAccountSources([
  { label: 'Bank of America · Plaid Checking', total: 89.4 },
])
assert(singleSource?.type === 'single', 'Single account source detected')
assert(
  singleSource.label === 'Bank of America · Plaid Checking',
  'Single source returns label only'
)
console.log('  pass: single-source category omits per-account amount')
passed++

const multiSource = formatCategoryAccountSources([
  { label: 'Bank of America · Plaid Checking', total: 50 },
  { label: 'Chase · Plaid Checking', total: 39.4 },
])
assert(multiSource?.type === 'multi', 'Multi account source detected')
assert(multiSource.entries.length === 2, 'Multi source keeps per-account totals')
console.log('  pass: multi-source category keeps amount breakdown')
passed++

const recurringSingle = formatRecurringAccountSource({
  accountLabel: 'Bank of America · Plaid Checking',
  accounts: [{ label: 'Bank of America · Plaid Checking' }],
})
assert(recurringSingle?.type === 'single', 'Recurring single account source')
console.log('  pass: recurring single-source attribution')
passed++

console.log(`\n${passed}/${passed} tests passed`)
