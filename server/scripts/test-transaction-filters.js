/*
 * Unit tests for shared cash-flow classification, filters, and liability balances.
 *
 * Usage: node --test scripts/test-transaction-filters.js
 */

import { test } from 'node:test'

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
  getCreditAvailable,
  getCreditSpent,
  getDisplayBalance,
  isLiabilityAccount,
} from '../utils/balanceHelpers.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test("transaction filters + balance helpers", () => {
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
  assert(
    isCashFlowIncomeRow({
      category: 'Transfer',
      name: 'Mobile Banking Deposit',
      amount: -7000,
      date: '2026-07-08',
      pending: false,
    }),
    'Bank deposit (Plaid Transfer category) counts as Money in'
  )
  assert(
    !isInternalMoveTransaction({
      category: 'Transfer',
      name: 'ATM CASH DEPOSIT',
      amount: -7000,
    }),
    'ATM deposit is not an internal move'
  )
  assert(
    isInternalMoveTransaction({
      category: 'Transfer',
      name: 'Online Banking transfer from CHECKING',
      amount: -500,
    }),
    'Own-account transfer credit stays internal'
  )
  assert(
    isCashFlowSpendingRow({
      category: 'ATM',
      name: 'BANK OF AMERICA ATM',
      amount: 200,
      date: '2026-07-08',
      pending: false,
    }),
    'ATM cash withdrawal counts as Money out'
  )
  assert(
    classifyCashFlowTransaction({
      category: 'ATM',
      name: 'ATM WITHDRAWAL',
      amount: 200,
      date: '2026-07-08',
      pending: false,
    }) === 'cash_out',
    'ATM withdrawal → cash_out'
  )
  assert(
    classifyCashFlowTransaction({
      category: 'Transfer',
      name: 'Mobile Banking Deposit',
      amount: -7000,
      date: '2026-07-08',
      pending: false,
    }) === 'self_deposit',
    'Mobile deposit → self_deposit'
  )
  assert(
    classifyCashFlowTransaction({
      category: 'Transfer',
      name: 'DIRECT DEPOSIT ACME CORP',
      amount: -3200,
      date: '2026-07-08',
      pending: false,
    }) === 'income',
    'Direct deposit payroll → income (not self_deposit)'
  )
  assert(
    classifyCashFlowTransaction({
      category: 'Payroll',
      name: 'DIR DEP PAYROLL',
      amount: -2500,
      date: '2026-07-08',
      pending: false,
    }) === 'income',
    'DIR DEP payroll → income'
  )
  assert(
    isCashFlowIncomeRow({
      category: 'Self deposit',
      name: 'DIRECT DEPOSIT WEEKLY',
      amount: -1800,
      date: '2026-07-08',
      pending: false,
    }),
    'Mis-tagged payroll still counts as Money in via name'
  )
  console.log('  pass: cash-flow row helpers including Zelle + deposits + cash out')
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
    {
      name: 'Mobile Banking Deposit',
      category: 'Transfer',
      amount: -7000,
      date: '2026-07-04',
      pending: false,
    },
    {
      name: 'ATM WITHDRAWAL',
      category: 'ATM',
      amount: 60,
      date: '2026-07-03',
      pending: false,
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
    classifyCashFlowTransaction(ledgerRows[3]) === 'self_transfer',
    'Transfer to Savings → self_transfer'
  )
  assert(
    classifyCashFlowTransaction(ledgerRows[4]) === 'liability_payment',
    'Card autopay → liability_payment'
  )
  assert(
    classifyCashFlowTransaction(ledgerRows[5]) === null,
    'Pending rows are not classified'
  )
  assert(
    classifyCashFlowTransaction(ledgerRows[6]) === 'self_deposit',
    'Mobile deposit → self_deposit'
  )
  assert(
    classifyCashFlowTransaction(ledgerRows[7]) === 'cash_out',
    'ATM withdrawal → cash_out'
  )

  const summary = summarizeCashFlow(ledgerRows, { activityLimit: 20 })

  assert(summary.moneyIn === 12200, 'moneyIn = payroll + Zelle + self deposit')
  assert(summary.moneyOut === 74, 'moneyOut = Chipotle + cash out')
  assert(summary.net === 12126, 'net = moneyIn - moneyOut')
  assert(summary.byKind.peer_in === 2000, 'byKind.peer_in')
  assert(summary.byKind.income === 3200, 'byKind.income')
  assert(summary.byKind.self_deposit === 7000, 'byKind.self_deposit')
  assert(summary.byKind.spend === 14, 'byKind.spend')
  assert(summary.byKind.cash_out === 60, 'byKind.cash_out')
  assert(summary.byKind.self_transfer === 500, 'byKind.self_transfer')
  assert(summary.byKind.liability_payment === 250, 'byKind.liability_payment')
  assert(summary.selfTransfers === 500, 'selfTransfers separate from moneyOut')
  assert(summary.internalMoved === 500, 'internalMoved alias for selfTransfers')
  assert(summary.liabilityPayments === 250, 'liabilityPayments separate from moneyOut')
  assert(summary.activity.length === 7, 'activity includes all posted classified rows')
  assert(
    summary.activity.some((row) => row.kind === 'self_transfer'),
    'activity includes self transfer'
  )
  assert(
    summary.activity.some((row) => row.kind === 'self_deposit' && row.badge === 'Self deposit'),
    'self deposit badge'
  )
  assert(
    summary.activity.some((row) => row.kind === 'cash_out' && row.badge === 'Cash out'),
    'cash out badge'
  )
  assert(
    summary.activity.find((row) => row.kind === 'peer_in')?.badge === 'Zelle in',
    'Zelle peer_in gets Zelle in badge'
  )
  assert(
    summary.activity.find((row) => row.kind === 'self_transfer')?.badge ===
      'Self transfer out',
    'self transfer debit badge'
  )
  console.log('  pass: classifyCashFlowTransaction + summarizeCashFlow accuracy')
  passed++

  const recent = buildRecentCashFlowActivity(ledgerRows, 12)

  assert(recent.length === 7, 'recent activity includes all classified posted rows')
  assert(recent[0].direction === 'in' && recent[0].amount === 2000, 'Zelle inflow listed first')
  assert(
    recent.some((row) => row.kind === 'self_transfer' && row.amount === 500),
    'self transfer appears in recent ledger'
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
  assert(getCreditSpent(card) === 400, 'credit spent is current owed')
  assert(getCreditAvailable(card) === 3000, 'credit available is remaining credit')
  assert(getCreditSpent(checking) === null, 'checking is not credit spent')
  assert(getCreditAvailable(loan) === null, 'loan has no available credit')
  assert(
    calculateTotalBalance([checking, card, loan]) === 2000 - 400 - 5000,
    'net balance subtracts all liabilities'
  )
  console.log('  pass: calculateTotalBalance with loans')
  passed++

})
