/*
 * Verifies Plaid personal_finance_category → stored category label mapping.
 *
 * Usage: node scripts/test-plaid-category.js
 */

import 'dotenv/config'
import { resolvePlaidTransactionCategory, resolveSpendingCategoryLabel } from '../utils/plaidCategory.js'

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

  assert(
    resolvePlaidTransactionCategory({
      name: 'Zelle payment to Akash Instyle Fix Conf# vuhwg6l5d',
      personal_finance_category: { primary: 'PERSONAL_CARE' },
    }) === 'Peer transfer',
    'Zelle overrides Plaid Personal Care mislabel'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'Venmo to Sam',
      personal_finance_category: { primary: 'GENERAL_MERCHANDISE' },
    }) === 'Peer transfer',
    'Venmo overrides merchandise mislabel'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'Starbucks',
      personal_finance_category: { primary: 'TRANSFER_OUT' },
    }) === 'Self transfer',
    'TRANSFER_* PFC primary maps to Self transfer'
  )

  assert(
    resolveSpendingCategoryLabel({
      name: 'Zelle payment to Akash',
      category: 'Personal Care',
    }) === 'Peer transfer',
    'Already-synced Zelle rows bucket as Peer transfer'
  )

  assert(
    resolveSpendingCategoryLabel({
      name: 'Some merchant',
      category: 'Transfer Out',
    }) === 'Self transfer',
    'Transfer Out labels normalize to Self transfer'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'Mobile Banking Deposit',
      amount: -7000,
      personal_finance_category: { primary: 'TRANSFER_IN' },
    }) === 'Self deposit',
    'ATM/mobile deposit credit maps to Self deposit'
  )

  assert(
    resolveSpendingCategoryLabel({
      name: 'ATM CASH DEPOSIT',
      category: 'Transfer',
      amount: -7000,
    }) === 'Self deposit',
    'Already-synced deposit rows bucket as Self deposit'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'Online Banking transfer from CHECKING',
      amount: -500,
      personal_finance_category: { primary: 'TRANSFER_IN' },
    }) === 'Self transfer',
    'Own-account transfer credit maps to Self transfer'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'ATM WITHDRAWAL 1234',
      amount: 100,
      personal_finance_category: { primary: 'TRANSFER_OUT' },
    }) === 'Cash out',
    'ATM withdrawal maps to Cash out'
  )

  assert(
    resolvePlaidTransactionCategory({
      name: 'DIRECT DEPOSIT ACME PAYROLL',
      amount: -3200,
      personal_finance_category: { primary: 'TRANSFER_IN' },
    }) === 'Income',
    'Direct deposit maps to Income, not Self deposit or Self transfer'
  )

  assert(
    resolveSpendingCategoryLabel({
      name: 'DIRECT DEPOSIT WEEKLY PAY',
      category: 'Self deposit',
      amount: -2000,
    }) === 'Income',
    'Read path: payroll memo not Self deposit even if category was wrong'
  )

  console.log('  pass: peer, self deposit, self transfer, cash out overrides')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
