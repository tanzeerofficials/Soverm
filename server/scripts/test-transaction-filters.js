/*
 * Unit tests for shared cash-flow classification, filters, and liability balances.
 *
 * Usage: node scripts/test-transaction-filters.js
 */

import {
  buildRecentCashFlowActivity,
  classifyCashFlowTransaction,
  isCashFlowIncomeRow,
  isCashFlowSpendingRow,
  isInternalMoveTransaction,
  isPeerPaymentTransaction,
  summarizeCashFlow,
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
assert(
  isPeerPaymentTransaction({ name: 'Zelle payment from Alex', category: 'Transfer' }),
  'Zelle is peer payment'
)
assert(
  !isInternalMoveTransaction({
    category: 'Transfer',
    name: 'Zelle payment from Alex',
    amount: -2000,
  }),
  'Received Zelle is not an internal move'
)
assert(
  !isInternalMoveTransaction({
    category: 'Transfer',
    name: 'Venmo to Sam',
    amount: 40,
  }),
  'Sent Venmo is not an internal move'
)
console.log('  pass: isInternalMoveTransaction + peer payments')
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
  'Own-account transfers do not count as spend'
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
assert(
  isCashFlowIncomeRow({
    category: 'Transfer',
    name: 'Zelle payment from Jordan',
    amount: -2000,
    date: '2026-07-01',
    pending: false,
  }),
  'Received Zelle counts as income'
)
assert(
  isCashFlowSpendingRow({
    category: 'Transfer',
    name: 'Zelle to Piyash Bhai',
    amount: 1000,
    date: '2026-07-01',
    pending: false,
  }),
  'Sent Zelle counts as spend'
)
console.log('  pass: cash-flow row helpers including Zelle')
passed++

/*
 * Accuracy lock: every posted txn gets one kind; Money in/out are external only.
 */
const ledgerRows = [
  {
    name: 'Zelle payment from Jordan',
    category: 'Transfer',
    amount: -2000,
    date: '2026-07-10',
    pending: false,
  },
  {
    name: 'ACME PAYROLL',
    category: 'Payroll',
    amount: -3200,
    date: '2026-07-09',
    pending: false,
  },
  {
    name: 'Chipotle',
    category: 'Food and Drink',
    amount: 14,
    date: '2026-07-08',
    pending: false,
  },
  {
    name: 'Transfer to Savings',
    category: 'Transfer',
    amount: 500,
    date: '2026-07-07',
    pending: false,
  },
  {
    name: 'CREDIT CARD AUTOPAY',
    category: 'Payment',
    amount: 250,
    date: '2026-07-06',
    pending: false,
  },
  {
    name: 'Pending Chipotle',
    category: 'Food and Drink',
    amount: 12,
    date: '2026-07-05',
    pending: true,
  },
]

assert(
  classifyCashFlowTransaction(ledgerRows[0]) === 'peer_in',
  'Zelle +$2000 → peer_in'
)
assert(
  classifyCashFlowTransaction(ledgerRows[1]) === 'income',
  'Payroll → income'
)
assert(
  classifyCashFlowTransaction(ledgerRows[2]) === 'spend',
  'Chipotle → spend'
)
assert(
  classifyCashFlowTransaction(ledgerRows[3]) === 'internal_transfer',
  'Transfer to Savings → internal_transfer'
)
assert(
  classifyCashFlowTransaction(ledgerRows[4]) === 'liability_payment',
  'Card autopay → liability_payment'
)
assert(
  classifyCashFlowTransaction(ledgerRows[5]) === null,
  'Pending rows are not classified'
)

const summary = summarizeCashFlow(ledgerRows, { activityLimit: 20 })

assert(summary.moneyIn === 5200, 'moneyIn = payroll + Zelle only')
assert(summary.moneyOut === 14, 'moneyOut = Chipotle only (not transfer/CC)')
assert(summary.net === 5186, 'net = moneyIn - moneyOut')
assert(summary.byKind.peer_in === 2000, 'byKind.peer_in')
assert(summary.byKind.income === 3200, 'byKind.income')
assert(summary.byKind.spend === 14, 'byKind.spend')
assert(summary.byKind.internal_transfer === 500, 'byKind.internal_transfer')
assert(summary.byKind.liability_payment === 250, 'byKind.liability_payment')
assert(summary.internalMoved === 500, 'internalMoved separate from moneyOut')
assert(summary.liabilityPayments === 250, 'liabilityPayments separate from moneyOut')
assert(summary.activity.length === 5, 'activity includes all posted classified rows')
assert(
  summary.activity.some((row) => row.kind === 'internal_transfer'),
  'activity includes own-account transfer'
)
assert(
  summary.activity.some((row) => row.kind === 'liability_payment'),
  'activity includes card payment'
)
assert(
  summary.activity.find((row) => row.kind === 'peer_in')?.badge === 'Zelle in',
  'Zelle peer_in gets Zelle in badge'
)
console.log('  pass: classifyCashFlowTransaction + summarizeCashFlow accuracy')
passed++

const recent = buildRecentCashFlowActivity(ledgerRows, 8)

assert(recent.length === 5, 'recent activity includes all classified posted rows')
assert(recent[0].direction === 'in' && recent[0].amount === 2000, 'Zelle inflow listed first')
assert(
  recent.some((row) => row.kind === 'internal_transfer' && row.amount === 500),
  'own-account transfer appears in recent ledger'
)
assert(
  recent.some((row) => row.kind === 'liability_payment' && row.amount === 250),
  'card payment appears in recent ledger'
)
console.log('  pass: buildRecentCashFlowActivity full ledger')
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
