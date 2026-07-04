/*
 * Verifies detection reasons, confidence tiers, and review partitioning.
 *
 * Usage: node scripts/test-recurring-detection-meta.js
 */

import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
  detectBorderlineRecurringCandidates,
  detectRecurringChargesFromTransactions,
} from '../utils/expenseAnalyzerData.js'
import { mergeRecurringCharges } from '../services/plaidRecurring.js'
import { partitionRecurringCharges } from '../utils/recurringDetectionMeta.js'

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
  console.log('Recurring detection meta tests\n')

  const confirmedTx = [
    tx('SPOTIFY', 10.99, 5),
    tx('SPOTIFY', 10.99, 35),
    tx('SPOTIFY', 10.99, 65),
  ]

  const confirmed = detectRecurringChargesFromTransactions(confirmedTx)[0]
  assert(confirmed.confidence === 'high', '3-hit keyword match should be high confidence')
  assert(confirmed.needsReview === false, 'High confidence should not need review')
  assert(confirmed.detectionReason?.code === 'keyword_match', 'Should explain keyword match')
  console.log('  pass: confirmed charge includes detection reason')
  passed++

  const reviewTx = [
    tx('REPLIT, INC.', 25, 5, 'Software'),
    tx('REPLIT, INC.', 25, 35, 'Software'),
  ]

  const reviewHit = detectRecurringChargesFromTransactions(reviewTx)[0]
  assert(reviewHit.confidence === 'medium', '2-hit keyword should be medium confidence')
  assert(reviewHit.needsReview === true, '2-hit keyword should need review')
  assert(reviewHit.detectionReason?.code === 'keyword_partial', 'Should explain partial keyword evidence')
  console.log('  pass: partial keyword match goes to review tier')
  passed++

  const borderlineTx = [
    tx('SparkFun', 49.95, 5, 'Service'),
    tx('SparkFun', 49.95, 35, 'Service'),
  ]

  const acceptedKeys = new Set()
  const borderline = detectBorderlineRecurringCandidates(borderlineTx, acceptedKeys)
  assert(borderline.length === 1, 'Two identical monthly charges should become borderline candidate')
  assert(borderline[0].confidence === 'low', 'Borderline candidate should be low confidence')
  assert(borderline[0].detectionReason?.code === 'identical_borderline', 'Should explain borderline identical pattern')
  console.log('  pass: borderline identical-amount candidate detection')
  passed++

  const comparison = buildComparisonFromTransactions(confirmedTx)
  const payload = buildExpenseAnalyzerPayload(comparison, confirmedTx)
  assert(payload.recurringCharges.length === 1, 'Confirmed list should include Spotify')
  assert((payload.reviewCharges?.length ?? 0) === 0, 'Spotify should not appear in review')
  console.log('  pass: payload partitions confirmed vs review')
  passed++

  const heuristic = detectRecurringChargesFromTransactions(confirmedTx)
  const merged = mergeRecurringCharges(heuristic, [
    {
      merchant: 'Spotify',
      category: 'Subscriptions',
      averageAmount: 10.99,
      cadence: 'monthly',
      lastChargedDate: '2026-03-05',
      nextExpectedDate: '2026-04-05',
      occurrenceCount: 8,
      confidence: 'high',
      needsReview: false,
      monthlyEquivalent: 10.99,
      source: 'plaid',
      merchantKey: 'spotify',
      rawName: 'SPOTIFY',
      detectionReason: {
        code: 'plaid_verified',
        summary: 'Plaid verified recurring stream',
        detail: 'Mature stream with 8 linked transactions',
      },
      accounts: [],
      accountLabel: null,
      primaryAccount: null,
    },
  ])

  const spotify = merged.find((charge) => charge.merchant.toLowerCase().includes('spotify'))
  assert(spotify?.source === 'both', 'Merged charge should be both sources')
  assert(spotify?.detectionReason?.code === 'plaid_and_pattern', 'Merged charge should explain both signals')
  assert(spotify?.needsReview === false, 'Merged high-confidence charge should be confirmed')

  const { confirmed: mergedConfirmed, review: mergedReview } = partitionRecurringCharges(merged)
  assert(mergedConfirmed.length === 1, 'Merged Spotify should land in confirmed bucket')
  assert(mergedReview.length === 0, 'Merged Spotify should not be in review')
  console.log('  pass: plaid + heuristic merge reason and partition')
  passed++

  console.log(`\n${passed}/${passed} recurring detection meta tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
