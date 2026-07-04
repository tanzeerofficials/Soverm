/*
 * Verifies Plaid recurring stream merge with heuristic detection.
 *
 * Usage: node scripts/test-plaid-recurring-merge.js
 */

import { mergeRecurringCharges } from '../services/plaidRecurring.js'
import { detectRecurringChargesFromTransactions } from '../utils/expenseAnalyzerData.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, daysAgo, category = 'Subscriptions') {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)

  return {
    name,
    amount,
    date: date.toISOString().slice(0, 10),
    category,
    pending: false,
  }
}

let passed = 0

try {
  console.log('Plaid recurring merge tests\n')

  const transactions = [
    tx('NETFLIX.COM', 15.99, 5),
    tx('NETFLIX.COM', 15.99, 35),
    tx('NETFLIX.COM', 15.99, 65),
  ]

  const heuristic = detectRecurringChargesFromTransactions(transactions)
  assert(heuristic.length === 1, 'Heuristic should detect Netflix')
  assert(heuristic[0].source === 'heuristic', 'Heuristic charge should be tagged')

  const plaidOnly = [
    {
      merchant: 'Adobe Creative Cloud',
      category: 'Subscriptions',
      averageAmount: 54.99,
      cadence: 'monthly',
      lastChargedDate: '2026-03-01',
      nextExpectedDate: '2026-04-01',
      occurrenceCount: 6,
      confidence: 'high',
      monthlyEquivalent: 54.99,
      source: 'plaid',
      merchantKey: 'adobe creative cloud',
      rawName: 'ADOBE *CREATIVE CLOUD',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]

  const merged = mergeRecurringCharges(heuristic, plaidOnly)
  assert(merged.length === 2, 'Merged list should include heuristic and plaid-only streams')
  assert(
    merged.some((charge) => charge.merchant.includes('Adobe')),
    'Plaid-only stream should be included'
  )
  console.log('  pass: plaid-only stream appended')
  passed++

  const plaidMatch = [
    {
      merchant: 'Netflix',
      category: 'Subscriptions',
      averageAmount: 15.99,
      cadence: 'monthly',
      lastChargedDate: '2026-03-05',
      nextExpectedDate: '2026-04-05',
      occurrenceCount: 8,
      confidence: 'high',
      monthlyEquivalent: 15.99,
      source: 'plaid',
      merchantKey: 'netflix com',
      rawName: 'NETFLIX.COM',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]

  const mergedMatch = mergeRecurringCharges(heuristic, plaidMatch)
  const netflix = mergedMatch.find((charge) => charge.merchant.toLowerCase().includes('netflix'))

  assert(netflix?.source === 'both', 'Matching stream should be marked as both')
  assert(netflix?.confidence === 'high', 'Merged match should boost confidence')
  console.log('  pass: matching plaid stream merges with heuristic')
  passed++

  const paymentStream = [
    {
      merchant: 'Payment Thank You',
      category: 'Payment',
      averageAmount: 500,
      cadence: 'monthly',
      lastChargedDate: '2026-03-01',
      nextExpectedDate: '2026-04-01',
      occurrenceCount: 4,
      confidence: 'high',
      monthlyEquivalent: 500,
      source: 'plaid',
      merchantKey: 'payment thank you',
      rawName: 'PAYMENT THANK YOU',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]

  const mergedPayments = mergeRecurringCharges(heuristic, paymentStream)
  assert(
    !mergedPayments.some((charge) => charge.rawName === 'PAYMENT THANK YOU'),
    'Excluded payment streams should be skipped'
  )
  console.log('  pass: excluded plaid streams are filtered')
  passed++

  console.log(`\n${passed}/${passed} plaid recurring merge tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
