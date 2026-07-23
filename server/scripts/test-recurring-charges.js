/*
 * Verifies recurring charge detection filters and false-positive guards.
 *
 * Usage: node scripts/test-recurring-charges.js
 */

import 'dotenv/config'
import { normalizeMerchantName } from '../utils/merchantNormalize.js'
import {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
  isHardExcludedPaymentName,
  isNoisyRecurringCategory,
  matchesExcludedRecurringName,
  resolveSubscriptionMerchantKeyword,
} from '../utils/recurringChargeFilters.js'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
  dedupeCrossAccountTransactions,
  detectRecurringChargesFromTransactions,
} from '../utils/expenseAnalyzerData.js'
import { test } from 'node:test'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, date, category = null, pending = false, account = null) {
  return {
    name,
    amount,
    date,
    category,
    pending,
    account_id: account?.id ?? null,
    account_name: account?.name ?? null,
    bank_name: account?.bankName ?? null,
  }
}

let passed = 0

test('recurring charges', () => {
  console.log('Recurring charge detection tests\n')

  assert(isHardExcludedPaymentName('CREDIT CARD 3333 PAYMENT *//'), 'Hard payment exclusion')
  assert(
    isExcludedFromRecurringDetection(
      tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-01-05', null)
    ),
    'Credit card payment row excluded before pattern matching'
  )
  assert(isNoisyRecurringCategory(null), 'NULL category treated as noisy/uncategorized')
  assert(isCoincidentalMerchantName("McDonald's"), 'McDonald\'s is coincidental merchant')
  assert(isCoincidentalMerchantName('Uber 072515 SF**POOL**'), 'Uber is coincidental merchant')
  assert(
    normalizeMerchantName(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING'
    ) === 'replit inc replit com',
    'Bank descriptor Replit charges normalize to shared merchant key'
  )
  assert(
    normalizeMerchantName(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING'
    ) === 'claude ai subscription anthropic',
    'Bank descriptor Claude subscription maps to Claude subscription key'
  )
  console.log('  pass: payment exclusions and null-category handling')
  passed++

  const spotifyCharges = detectRecurringChargesFromTransactions([
    tx('SPOTIFY USA', 10.99, '2026-01-05'),
    tx('SPOTIFY*PREMIUM', 10.99, '2026-02-04'),
    tx('SPOTIFY', 10.99, '2026-03-06'),
  ])
  assert(spotifyCharges.length === 1, 'Expected one Spotify subscription')
  assert(spotifyCharges[0].occurrenceCount === 3, 'Expected 3 Spotify charges')
  console.log('  pass: keyword subscription still detected with null categories')
  passed++

  const replit = detectRecurringChargesFromTransactions([
    tx('REPLIT INC', 20, '2026-04-10', null),
    tx('REPLIT INC', 20, '2026-05-10', null),
  ])
  assert(replit.length === 1, 'Replit detected via subscription keyword with 2 monthly hits')
  assert(replit[0].confidence === 'medium', 'Replit at 2 hits is medium confidence')
  console.log('  pass: Replit SaaS subscription detected by keyword')
  passed++

  const anthropic = detectRecurringChargesFromTransactions([
    tx('ANTHROPIC', 20, '2026-04-10', null),
    tx('ANTHROPIC', 20, '2026-05-10', null),
  ])
  assert(anthropic.length === 1, 'Anthropic detected via subscription keyword')
  console.log('  pass: Anthropic SaaS subscription detected by keyword')
  passed++

  const railwayReplit = detectRecurringChargesFromTransactions([
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING',
      20.6,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING',
      20.6,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0522 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5660 RECURRING',
      20.6,
      '2026-05-26'
    ),
    tx(
      'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5699 RECURRING',
      20.6,
      '2026-06-23'
    ),
  ])
  assert(railwayReplit.length === 1, 'Real Replit bank descriptors form one recurring charge')
  assert(railwayReplit[0].merchant === 'Replit', 'Replit display label is human-readable')
  assert(railwayReplit[0].occurrenceCount === 3, 'Replit dedupes same-day duplicates')
  console.log('  pass: real-world Replit bank descriptor pattern detected')
  passed++

  const railwayClaude = detectRecurringChargesFromTransactions([
    tx(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING',
      21.2,
      '2026-05-05'
    ),
    tx(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING',
      21.2,
      '2026-05-05'
    ),
    tx(
      'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING',
      21.2,
      '2026-06-05'
    ),
    tx(
      'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING',
      21.2,
      '2026-06-05'
    ),
  ])
  assert(railwayClaude.length === 1, 'Real Claude/Anthropic descriptors form one recurring charge')
  assert(
    railwayClaude[0].merchant === 'Claude.ai Subscription',
    'Claude subscription display label is human-readable'
  )
  assert(railwayClaude[0].occurrenceCount === 2, 'Claude monthly pair detected after dedupe')
  assert(railwayClaude[0].confidence === 'high', 'Two identical keyword hits with distinct bank descriptors are confirmed')
  assert(railwayClaude[0].needsReview === false, 'Claude subscription should not be relegated to review')
  console.log('  pass: real-world Claude bank descriptor pattern detected')
  passed++

  const productionAnthropicClaudeRows = [
    tx(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING',
      21.2,
      '2026-05-05'
    ),
    tx(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING',
      21.2,
      '2026-05-05'
    ),
    tx(
      'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING',
      21.2,
      '2026-06-05'
    ),
    tx(
      'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING',
      21.2,
      '2026-06-05'
    ),
    tx('PURCHASE 0617 ANTHROPIC ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1768', 5.15, '2026-06-18'),
    tx('PURCHASE 0617 ANTHROPIC ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1768', 5.15, '2026-06-18'),
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING',
      20.6,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING',
      20.6,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX9533 RECURRING',
      25.36,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX9533 RECURRING',
      25.36,
      '2026-04-23'
    ),
    tx(
      'PURCHASE 0522 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5660 RECURRING',
      20.6,
      '2026-05-26'
    ),
    tx(
      'PURCHASE 0522 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5660 RECURRING',
      20.6,
      '2026-05-26'
    ),
    tx(
      'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5699 RECURRING',
      23.02,
      '2026-06-23'
    ),
    tx(
      'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5699 RECURRING',
      23.02,
      '2026-06-23'
    ),
    tx(
      'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6348 RECURRING',
      20.6,
      '2026-06-23'
    ),
    tx(
      'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6348 RECURRING',
      20.6,
      '2026-06-23'
    ),
  ]

  const productionPayload = buildExpenseAnalyzerPayload(
    buildComparisonFromTransactions(productionAnthropicClaudeRows),
    productionAnthropicClaudeRows
  )
  const claudeConfirmed = productionPayload.recurringCharges.find(
    (charge) => charge.merchant === 'Claude.ai Subscription'
  )
  assert(claudeConfirmed, 'real-world Anthropic Claude subscription with mixed charge amounts — confirmed recurring')
  assert(claudeConfirmed.averageAmount === 21.2, 'Claude subscription amount is $21.20')
  assert(claudeConfirmed.confidence === 'high', 'Claude subscription is high confidence in production-shaped data')
  assert(
    !productionPayload.reviewCharges.some((charge) => charge.merchant === 'Claude.ai Subscription'),
    'Claude subscription must not be hidden in review when bank descriptors cross-match'
  )
  assert(
    productionPayload.recurringCharges.some((charge) => charge.merchant === 'Replit'),
    'Replit remains confirmed alongside Claude'
  )
  assert(
    !productionPayload.recurringCharges.some((charge) => charge.averageAmount === 5.15),
    '$5.15 Anthropic API charge must stay out of confirmed recurring'
  )
  console.log('  pass: real-world Anthropic Claude subscription with mixed charge amounts')
  passed++

  const anthropicProducts = detectRecurringChargesFromTransactions([
    tx(
      'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING',
      21.2,
      '2026-05-05'
    ),
    tx(
      'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING',
      21.2,
      '2026-06-05'
    ),
    tx('PURCHASE 0617 ANTHROPIC ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1768', 5.15, '2026-06-18'),
    tx('PURCHASE 0617 ANTHROPIC ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1768', 5.15, '2026-06-18'),
  ])
  assert(
    anthropicProducts.length === 1,
    'Only the Claude subscription pair is detected; $5.15 Anthropic API stays separate'
  )
  assert(anthropicProducts[0].averageAmount === 21.2, 'Detected Anthropic product is the subscription amount')
  console.log('  pass: distinct Anthropic products are not merged')
  passed++

  const sparkfun = detectRecurringChargesFromTransactions([
    tx('SparkFun', 89.4, '2026-04-10', null),
    tx('SparkFun', 89.4, '2026-05-10', null),
    tx('SparkFun', 89.4, '2026-06-09', null),
  ])
  assert(sparkfun.length === 1, 'SparkFun should still be detected with identical monthly charges')
  assert(sparkfun[0].averageAmount === 89.4, 'SparkFun average amount mismatch')
  assert(sparkfun[0].confidence === 'medium', 'Non-keyword identical fallback is medium confidence')
  console.log('  pass: SparkFun recurring pattern still detected')
  passed++

  const looseGaps = detectRecurringChargesFromTransactions([
    tx('Obscure SaaS Co', 49, '2026-01-01', null),
    tx('Obscure SaaS Co', 49, '2026-02-02', null),
    tx('Obscure SaaS Co', 49, '2026-03-05', null),
  ])
  assert(looseGaps.length === 0, '32-day gaps must fail identical-amount fallback (28-31 only)')
  console.log('  pass: identical-amount fallback requires 28-31 day gaps')
  passed++

  const tightGaps = detectRecurringChargesFromTransactions([
    tx('Obscure SaaS Co', 49, '2026-01-01', null),
    tx('Obscure SaaS Co', 49, '2026-01-29', null),
    tx('Obscure SaaS Co', 49, '2026-02-28', null),
  ])
  assert(tightGaps.length === 1, '28-31 day gaps with identical amounts should pass fallback')
  assert(tightGaps[0].confidence === 'medium', 'Fallback detection is medium confidence')
  console.log('  pass: identical-amount fallback accepts tight monthly spacing')
  passed++

  const creditCardPattern = detectRecurringChargesFromTransactions([
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-04-14', null),
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-05-14', null),
    tx('CREDIT CARD 3333 PAYMENT *//', 25, '2026-06-13', null),
  ])
  assert(creditCardPattern.length === 0, 'Credit card payments must never appear')
  console.log('  pass: credit card payment excluded even with monthly pattern')
  passed++

  const mcdonalds = detectRecurringChargesFromTransactions([
    tx("McDonald's", 12, '2026-04-11', null),
    tx("McDonald's", 12, '2026-05-11', null),
    tx("McDonald's", 12, '2026-06-10', null),
  ])
  assert(mcdonalds.length === 0, 'McDonald\'s must be blocked via merchant denylist')
  console.log('  pass: McDonald\'s false positive blocked')
  passed++

  const uber = detectRecurringChargesFromTransactions([
    tx('Uber 072515 SF**POOL**', 6.33, '2026-04-27', null),
    tx('Uber 072515 SF**POOL**', 6.33, '2026-05-27', null),
    tx('Uber 072515 SF**POOL**', 6.33, '2026-06-26', null),
  ])
  assert(uber.length === 0, 'Uber rides must be blocked via merchant denylist')
  console.log('  pass: Uber false positive blocked')
  passed++

  const starbucks = detectRecurringChargesFromTransactions([
    tx('Starbucks', 4.33, '2026-04-11', null),
    tx('Starbucks', 4.33, '2026-05-11', null),
    tx('Starbucks', 4.33, '2026-06-10', null),
  ])
  assert(starbucks.length === 0, 'Starbucks should be blocked as coincidental merchant')
  console.log('  pass: Starbucks false positive blocked')
  passed++

  const looseAmounts = detectRecurringChargesFromTransactions([
    tx('Some Vendor', 10, '2026-01-05', null),
    tx('Some Vendor', 11, '2026-02-04', null),
    tx('Some Vendor', 10.5, '2026-03-06', null),
  ])
  assert(looseAmounts.length === 0, 'Non-keyword merchants need identical amounts')
  console.log('  pass: non-keyword merchants require identical amounts')
  passed++

  const variableUtility = detectRecurringChargesFromTransactions([
    tx('ConEd', 42.1, '2026-01-05', 'Rent And Utilities'),
    tx('ConEd', 43.85, '2026-02-04', 'Rent And Utilities'),
    tx('ConEd', 41.9, '2026-03-06', 'Rent And Utilities'),
  ])
  assert(variableUtility.length === 1, 'Variable utility bill within 5% should be detected')
  assert(
    variableUtility[0].firstAmount === 42.1 && variableUtility[0].lastAmount === 41.9,
    'Utility first/last amounts preserved from unclustered chain'
  )
  console.log('  pass: variable-amount utility bill detected via tolerance retry')
  passed++

  const spotifyPriceChange = detectRecurringChargesFromTransactions([
    tx('SPOTIFY USA', 10.99, '2026-01-05', 'Subscriptions'),
    tx('SPOTIFY', 11.99, '2026-02-04', 'Subscriptions'),
  ])
  assert(spotifyPriceChange.length === 1, 'Keyword merchant with 2 slightly different amounts')
  assert(
    spotifyPriceChange[0].firstAmount === 10.99 && spotifyPriceChange[0].lastAmount === 11.99,
    'Spotify price change first/last preserved'
  )
  console.log('  pass: keyword merchant price change detected without identical cents')
  passed++

  const multiAccount = detectRecurringChargesFromTransactions([
    tx('SPOTIFY', 10.99, '2026-04-10', 'Subscriptions', false, {
      id: 'acct-checking',
      name: 'Checking',
      bankName: 'Chase',
    }),
    tx('SPOTIFY', 10.99, '2026-05-10', 'Subscriptions', false, {
      id: 'acct-checking',
      name: 'Checking',
      bankName: 'Chase',
    }),
  ])
  assert(multiAccount.length === 1, 'Expected one Spotify recurring charge')
  assert(
    multiAccount[0].accountLabel === 'Chase · Checking',
    'Recurring charge includes primary account label'
  )
  assert(multiAccount[0].accounts?.length === 1, 'Single account attached to recurring charge')
  console.log('  pass: recurring charges include account attribution')
  passed++

  const checking = { id: 'acct-checking', name: 'Checking', bankName: 'Chase' }
  const savings = { id: 'acct-savings', name: 'Savings', bankName: 'Chase' }

  const crossAccountDeduped = dedupeCrossAccountTransactions([
    tx('NETFLIX.COM', 15.99, '2026-06-01', 'Subscriptions', false, checking),
    tx('NETFLIX.COM', 15.99, '2026-06-02', 'Subscriptions', false, savings),
  ])
  assert(crossAccountDeduped.length === 1, 'Cross-account near-duplicates collapse')
  assert(crossAccountDeduped[0].accounts?.length === 2, 'Merged accounts retained')
  console.log('  pass: cross-account dedupe collapses mirrors')
  passed++

  const sameAccountTwins = dedupeCrossAccountTransactions([
    tx('NETFLIX.COM', 15.99, '2026-06-01', 'Subscriptions', false, checking),
    tx('NETFLIX.COM', 15.99, '2026-06-03', 'Subscriptions', false, checking),
  ])
  assert(
    sameAccountTwins.length === 2,
    'Same-account twins within 3 days must not collapse'
  )
  console.log('  pass: same-account twins stay separate')
  passed++

  const sameDayDupes = dedupeCrossAccountTransactions([
    tx('NETFLIX.COM', 15.99, '2026-06-01', 'Subscriptions', false, checking),
    tx('NETFLIX.COM', 15.99, '2026-06-01', 'Subscriptions', false, checking),
  ])
  assert(sameDayDupes.length === 1, 'Same-day sync duplicates still collapse')
  console.log('  pass: same-day duplicates still collapse')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
})
