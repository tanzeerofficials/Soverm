/*
 * Unit tests for shared cash-flow transaction filters and liability balances.
 *
 * Usage: node scripts/test-transaction-filters.js
 */

import {
  isCashFlowIncomeRow,
  isCashFlowSpendingRow,
  isInternalMoveTransaction,
} from '../utils/transactionFilters.js'
import {
  calculateTotalBalance,
  getDisplayBalance,
  isLiabilityAccount,
} from '../utils/balanceHelpers.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

console.log('Transaction filter + balance tests\n')

assert(
  isInternalMoveTransaction({ category: 'Transfer', name: 'Savings', amount: 100 }),
  'Transfer category is internal'
)
assert(
  isInternalMoveTransaction({ category: 'Payment', name: 'CREDIT CARD AUTOPAY', amount: 200 }),
  'Payment category is internal'
)
assert(
  !isInternalMoveTransaction({ category: 'Food and Drink', name: 'Chipotle', amount: 14 }),
  'Normal spend is not internal'
)
console.log('  pass: isInternalMoveTransaction')
passed++

assert(
  isCashFlowSpendingRow({
    category: 'Food and Drink',
    name: 'Chipotle',
    amount: 14,
    date: '2026-07-01',
    pending: false,
  }),
  'Real spend counts'
)
assert(
  !isCashFlowSpendingRow({
    category: 'Transfer',
    name: 'Transfer to Savings',
    amount: 500,
    date: '2026-07-01',
    pending: false,
  }),
  'Transfers do not count as spend'
)
assert(
  !isCashFlowIncomeRow({
    category: 'Payment',
    name: 'Payment Thank You',
    amount: -250,
    date: '2026-07-01',
    pending: false,
  }),
  'Card payment credits do not count as income'
)
assert(
  isCashFlowIncomeRow({
    category: 'Payroll',
    name: 'ACME PAYROLL',
    amount: -2000,
    date: '2026-07-01',
    pending: false,
  }),
  'Payroll counts as income'
)
console.log('  pass: cash-flow row helpers')
passed++

assert(isLiabilityAccount({ account_type: 'credit card' }), 'credit card is liability')
assert(isLiabilityAccount({ account_type: 'mortgage' }), 'mortgage is liability')
assert(isLiabilityAccount({ account_type: 'student' }), 'student loan is liability')
assert(!isLiabilityAccount({ account_type: 'checking' }), 'checking is not liability')
console.log('  pass: isLiabilityAccount')
passed++

const checking = {
  account_type: 'checking',
  balance_available: 2000,
  balance_current: 2100,
}
const card = {
  account_type: 'credit card',
  balance_available: 3000,
  balance_current: 400,
}
const loan = {
  account_type: 'student',
  balance_available: null,
  balance_current: 5000,
}

assert(getDisplayBalance(checking) === 2000, 'checking uses available')
assert(getDisplayBalance(card) === 400, 'credit uses current owed')
assert(getDisplayBalance(loan) === 5000, 'loan uses current owed')
assert(
  calculateTotalBalance([checking, card, loan]) === 2000 - 400 - 5000,
  'net balance subtracts all liabilities'
)
console.log('  pass: calculateTotalBalance with loans')
passed++

console.log(`\n${passed}/${passed} transaction filter tests passed.`)
