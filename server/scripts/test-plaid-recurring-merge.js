/*
 * Verifies Plaid recurring stream merge with heuristic detection.
 *
 * Usage: node scripts/test-plaid-recurring-merge.js
 */

import 'dotenv/config'
import { mergeRecurringCharges, mapPlaidStreamToRecurringCharge } from '../services/plaidRecurring.js'
import { detectRecurringChargesFromTransactions } from '../utils/expenseAnalyzerData.js'
import { test } from 'node:test'

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

test('plaid recurring merge', () => {
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
      merchantKey: 'netflix',
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

  const spotifyHeuristic = [
    {
      merchant: 'Spotify',
      category: 'Subscriptions',
      averageAmount: 11.99,
      firstAmount: 11.99,
      lastAmount: 11.99,
      cadence: 'monthly',
      occurrenceCount: 3,
      confidence: 'high',
      monthlyEquivalent: 11.99,
      source: 'heuristic',
      merchantKey: 'spotify',
      rawName: 'SPOTIFY',
    },
  ]
  const huluPlaidSameAmount = [
    {
      merchant: 'Hulu',
      category: 'Subscriptions',
      averageAmount: 11.99,
      firstAmount: 11.99,
      lastAmount: 11.99,
      cadence: 'monthly',
      occurrenceCount: 6,
      confidence: 'high',
      monthlyEquivalent: 11.99,
      source: 'plaid',
      merchantKey: 'hulu',
      rawName: 'HULU',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]
  const mergedSameAmount = mergeRecurringCharges(spotifyHeuristic, huluPlaidSameAmount)
  assert(mergedSameAmount.length === 2, 'Same-dollar streams must not merge across merchants')
  assert(
    mergedSameAmount.every((charge) => charge.source !== 'both'),
    'Amount-only match must not promote source to both'
  )
  assert(
    mergedSameAmount.some((c) => c.merchantKey === 'spotify') &&
      mergedSameAmount.some((c) => c.merchantKey === 'hulu'),
    'Spotify and Hulu both remain'
  )
  console.log('  pass: amount-similar unrelated merchants stay separate')
  passed++

  const uberOnePlaid = [
    {
      merchant: 'Uber One',
      category: 'Subscriptions',
      averageAmount: 9.99,
      firstAmount: 9.99,
      lastAmount: 9.99,
      cadence: 'monthly',
      occurrenceCount: 6,
      confidence: 'high',
      monthlyEquivalent: 9.99,
      source: 'plaid',
      merchantKey: 'uber one',
      rawName: 'UBER ONE MEMBERSHIP',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]
  const mergedUber = mergeRecurringCharges([], uberOnePlaid)
  const uberOne = mergedUber.find((charge) => charge.merchantKey === 'uber one')
  assert(uberOne, 'Plaid-verified Uber One must not be dropped by coincidental UBER denylist')
  assert(uberOne.needsReview === true, 'Coincidental-brand Plaid stream goes to Review')
  assert(uberOne.confidence === 'medium', 'Coincidental-brand Plaid stream is not auto-confirmed')
  console.log('  pass: Plaid membership streams route to Review (not dropped)')
  passed++

  const dashPassPlaid = [
    {
      merchant: 'DashPass',
      category: 'Subscriptions',
      averageAmount: 9.99,
      firstAmount: 9.99,
      lastAmount: 9.99,
      cadence: 'monthly',
      occurrenceCount: 5,
      confidence: 'high',
      monthlyEquivalent: 9.99,
      source: 'plaid',
      merchantKey: 'dashpass',
      rawName: 'DOORDASH DASHPASS',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]
  const mergedDash = mergeRecurringCharges([], dashPassPlaid)
  const dashPass = mergedDash.find((c) => c.merchantKey === 'dashpass')
  assert(dashPass, 'DashPass must not be dropped')
  assert(dashPass.needsReview === true, 'DashPass lands in Review')
  console.log('  pass: DoorDash DashPass routes to Review')
  passed++

  // Same merchant key, different amounts — must stay separate (APPLE.COM/BILL twins)
  const appleHeuristic = [
    {
      merchant: 'Apple',
      category: 'Subscriptions',
      averageAmount: 2.99,
      firstAmount: 2.99,
      lastAmount: 2.99,
      cadence: 'monthly',
      occurrenceCount: 3,
      confidence: 'medium',
      monthlyEquivalent: 2.99,
      source: 'heuristic',
      merchantKey: 'apple com bill',
      rawName: 'APPLE.COM/BILL',
    },
  ]
  const applePlaidTwins = [
    {
      merchant: 'iCloud',
      category: 'Subscriptions',
      averageAmount: 2.99,
      firstAmount: 2.99,
      lastAmount: 2.99,
      cadence: 'monthly',
      occurrenceCount: 6,
      confidence: 'high',
      monthlyEquivalent: 2.99,
      source: 'plaid',
      merchantKey: 'apple com bill',
      rawName: 'APPLE.COM/BILL',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
    {
      merchant: 'Apple TV',
      category: 'Subscriptions',
      averageAmount: 9.99,
      firstAmount: 9.99,
      lastAmount: 9.99,
      cadence: 'monthly',
      occurrenceCount: 6,
      confidence: 'high',
      monthlyEquivalent: 9.99,
      source: 'plaid',
      merchantKey: 'apple com bill',
      rawName: 'APPLE.COM/BILL',
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ]
  const mergedApple = mergeRecurringCharges(appleHeuristic, applePlaidTwins)
  assert(mergedApple.length === 2, 'Distinct same-merchant amounts must not collapse')
  assert(
    mergedApple.some((c) => c.averageAmount === 2.99) &&
      mergedApple.some((c) => c.averageAmount === 9.99),
    'Both iCloud-priced and Apple TV-priced streams remain'
  )
  assert(
    mergedApple.find((c) => c.averageAmount === 2.99)?.source === 'both',
    'Amount-similar Apple stream merges with heuristic'
  )
  assert(
    mergedApple.find((c) => c.averageAmount === 9.99)?.source === 'plaid',
    'Different-amount Apple stream stays plaid-only'
  )
  console.log('  pass: same-merchant distinct amounts stay separate')
  passed++

  // UNKNOWN frequency: infer annual from dates; otherwise review-only
  const annualUnknown = mapPlaidStreamToRecurringCharge({
    merchant_name: 'Annual Insurance',
    description: 'ANNUAL INSURANCE',
    frequency: 'UNKNOWN',
    status: 'MATURE',
    average_amount: { amount: 600 },
    first_date: '2024-01-15',
    last_date: '2026-01-15',
    transaction_ids: ['a', 'b', 'c'],
    account_id: 'acc-1',
    stream_id: 'stream-annual',
  })
  assert(annualUnknown.cadence === 'annual', 'UNKNOWN + ~365d gap infers annual')
  assert(annualUnknown.monthlyEquivalent === 50, 'Annual UNKNOWN uses amount/12')
  assert(annualUnknown.needsReview === false, 'Inferred mature annual is confirmed')
  console.log('  pass: UNKNOWN frequency infers annual from dates')
  passed++

  const unknownNoDates = mapPlaidStreamToRecurringCharge({
    merchant_name: 'Mystery Sub',
    description: 'MYSTERY SUB',
    frequency: 'UNKNOWN',
    status: 'MATURE',
    average_amount: { amount: 99 },
    first_date: null,
    last_date: null,
    transaction_ids: ['x'],
    account_id: 'acc-1',
    stream_id: 'stream-mystery',
  })
  assert(unknownNoDates.cadence === 'unknown', 'Uninferable UNKNOWN stays unknown')
  assert(unknownNoDates.needsReview === true, 'Uninferable UNKNOWN is review-only')
  assert(unknownNoDates.monthlyEquivalent === 99, 'Review placeholder uses raw average')
  assert(unknownNoDates.confidence === 'medium', 'Uninferable UNKNOWN is not high confidence')
  console.log('  pass: uninferable UNKNOWN is review-only')
  passed++

  console.log(`\n${passed}/${passed} plaid recurring merge tests passed.`)
})
