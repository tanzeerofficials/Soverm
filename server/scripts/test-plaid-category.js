/*
 * Verifies Plaid personal_finance_category → stored category label mapping.
 *
 * Usage: node scripts/test-plaid-category.js
 */

import 'dotenv/config'
import { resolvePlaidTransactionCategory } from '../utils/plaidCategory.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Plaid category resolution tests\n')

  assert(
    resolvePlaidTransactionCategory({
      personal_finance_category: {
        primary: 'FOOD_AND_DRINK',
        detailed: 'FOOD_AND_DRINK_RESTAURANT',
      },
    }) === 'Food And Drink',
    'PFC primary formatted for storage'
  )

  assert(
    resolvePlaidTransactionCategory({
      category: ['Payment', 'Credit Card'],
    }) === 'Payment',
    'Legacy category array used when PFC missing'
  )

  assert(
    resolvePlaidTransactionCategory({
      personal_finance_category: { primary: 'GENERAL_SERVICES' },
      category: ['Shops'],
    }) === 'General Services',
    'PFC preferred over legacy category'
  )

  assert(resolvePlaidTransactionCategory({}) === null, 'Missing category returns null')
  console.log('  pass: category resolution priority and formatting')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
