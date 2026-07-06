/*
 * Verifies expense analyzer narrative brief + validation guardrails.
 *
 * Usage: node scripts/test-expense-analyzer-narrative.js
 */

import 'dotenv/config'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
} from '../utils/expenseAnalyzerData.js'
import {
  buildExpenseAnalyzerNarrativeBrief,
  buildNarrativeMeta,
  fingerprintExpenseAnalyzerBrief,
} from '../utils/expenseAnalyzerNarrativeBrief.js'
import {
  collectAllowedAmounts,
  validatePersonalNarrative,
} from '../utils/expenseAnalyzerNarrativeValidation.js'

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
  console.log('Expense analyzer narrative tests\n')

  const transactions = [
    tx('SPOTIFY', 10.99, 5),
    tx('SPOTIFY', 10.99, 35),
    tx('SPOTIFY', 10.99, 65),
    tx('Chipotle', 18.5, 3, 'Food and Drink'),
    tx('Chipotle', 22, 12, 'Food and Drink'),
  ]

  const comparison = buildComparisonFromTransactions(transactions)
  const payload = buildExpenseAnalyzerPayload(comparison, transactions)
  const brief = buildExpenseAnalyzerNarrativeBrief(payload)
  const meta = buildNarrativeMeta(payload)

  assert(meta.fingerprint.length === 32, 'Fingerprint should be 32 chars')
  assert(
    fingerprintExpenseAnalyzerBrief(brief) === meta.fingerprint,
    'Fingerprint should be stable for the same brief'
  )
  assert(brief.overallSpending.confirmedRecurringMonthly > 0, 'Brief includes confirmed recurring')
  assert(brief.confirmedRecurring.length === 1, 'Brief lists confirmed recurring merchants')
  assert(
    brief.overallSpending.confirmedRecurringAnnual ===
      Math.round(brief.overallSpending.confirmedRecurringMonthly * 12 * 100) / 100,
    'Annual recurring should be monthly × 12'
  )
  console.log('  pass: narrative brief and fingerprint')
  passed++

  const sparkFunBrief = {
    ...brief,
    overallSpending: {
      ...brief.overallSpending,
      confirmedRecurringMonthly: 89.4,
      confirmedRecurringAnnual: 1072.8,
    },
    confirmedRecurring: [
      {
        merchant: 'SparkFun',
        monthlyEquivalent: 89.4,
        category: 'General Merchandise',
      },
    ],
  }

  const annualNarrative = validatePersonalNarrative({
    lead: 'Your subscriptions add up to $1,072.80 a year.',
    paragraphs: [
      'Overall one-time spend is $40.50 in the last 30 days vs the prior 30 days.',
      'SparkFun runs $89.40/mo — that is $1,072.80 a year in confirmed recurring charges.',
    ],
    brief: sparkFunBrief,
  })
  assert(annualNarrative.valid, `Annual narrative should pass: ${annualNarrative.reason}`)
  console.log('  pass: annual recurring in narrative')
  passed++

  const valid = validatePersonalNarrative({
    lead: 'Spending rose in the last 30 days, mostly one-time dining.',
    paragraphs: [
      'Overall one-time spend is $40.50 in the last 30 days vs the prior 30 days.',
      'Confirmed recurring is $10.99/mo from Spotify — see the recurring list below.',
    ],
    brief,
  })
  assert(valid.valid, `Expected valid narrative, got ${valid.reason}`)
  console.log('  pass: valid narrative passes guardrails')
  passed++

  const invalidAmount = validatePersonalNarrative({
    lead: 'You spent $999.99 on mystery charges.',
    paragraphs: [
      'Overall spending shifted this period.',
      'Confirmed recurring remains unchanged.',
    ],
    brief,
  })
  assert(!invalidAmount.valid, 'Narrative with invented dollar amount should fail')
  console.log('  pass: invented dollar amounts rejected')
  passed++

  const reviewBrief = {
    ...brief,
    reviewItems: [
      {
        merchant: 'Replit',
        monthlyEquivalent: 25,
        category: 'Software',
        whyUncertain: 'Only 2 charges so far',
      },
    ],
    rules: {
      ...brief.rules,
      reviewCount: 1,
    },
  }

  const missingReviewAck = validatePersonalNarrative({
    lead: 'Confirmed recurring totals $10.99/mo.',
    paragraphs: [
      'Overall spending is steady across categories.',
      'Spotify is your only confirmed subscription.',
    ],
    brief: reviewBrief,
  })
  assert(!missingReviewAck.valid, 'Should require Review acknowledgment')

  const withReviewAck = validatePersonalNarrative({
    lead: 'Confirmed recurring is $10.99/mo; one item in Review is not counted yet.',
    paragraphs: [
      'Overall one-time spend is $40.50 in the last 30 days.',
      'Replit is in Review — too early to confirm — so it is not included in confirmed recurring.',
    ],
    brief: reviewBrief,
  })
  assert(withReviewAck.valid, `Review-aware narrative should pass: ${withReviewAck.reason}`)
  console.log('  pass: review acknowledgment enforced')
  passed++

  const noReviewExplicit = validatePersonalNarrative({
    lead: 'Spending held flat at $40.50 in the last 30 days.',
    paragraphs: [
      'Confirmed recurring is $10.99/mo from Spotify.',
      'There are no items currently in Review.',
    ],
    brief,
  })
  assert(noReviewExplicit.valid, `Explicit empty Review mention should pass: ${noReviewExplicit.reason}`)

  const falseReviewClaim = validatePersonalNarrative({
    lead: 'One item is in Review.',
    paragraphs: [
      'Overall one-time spend is $40.50 in the last 30 days.',
      'Spotify is your only confirmed subscription.',
    ],
    brief,
  })
  assert(!falseReviewClaim.valid, 'Should reject implied Review items when none exist')
  console.log('  pass: empty Review tier mention allowed when none exist')
  passed++

  const allowed = collectAllowedAmounts(brief)
  assert(allowed.has(brief.overallSpending.oneTimeTotal), 'Allowed amounts include one-time total')
  assert(
    allowed.has(brief.overallSpending.confirmedRecurringAnnual),
    'Allowed amounts include annual recurring'
  )
  console.log('  pass: allowed amount collection')
  passed++

  console.log(`\n${passed}/${passed} expense analyzer narrative tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
