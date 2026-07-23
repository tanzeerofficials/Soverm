/*
 * Verifies expense analyzer payload helpers and summary route data.
 *
 * Usage: node scripts/test-expense-analyzer-data.js
 */

import 'dotenv/config'
import { buildExpenseAnalyzerPromptBlock } from '../services/claude.js'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
  buildExpenseAnalyzerSummary,
  buildTemplateNarrative,
  detectRecurringChargesFromTransactions,
} from '../utils/expenseAnalyzerData.js'
import { test } from 'node:test'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, date, category = 'Subscriptions', account = null) {
  return {
    name,
    amount,
    date,
    category,
    pending: false,
    account_id: account?.id ?? null,
    account_name: account?.name ?? null,
    bank_name: account?.bankName ?? null,
  }
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

let passed = 0

test('expense analyzer data', () => {
  console.log('Expense analyzer data tests\n')

  const transactions = [
    tx('Dining Out', 400, daysAgo(5), 'Food and Drink'),
    tx('Dining Out', 300, daysAgo(40), 'Food and Drink'),
    tx('SPOTIFY', 10.99, daysAgo(10), 'Subscriptions'),
    tx('SPOTIFY', 10.99, daysAgo(40), 'Subscriptions'),
    tx('SPOTIFY', 10.99, daysAgo(70), 'Subscriptions'),
  ]

  const comparison = buildComparisonFromTransactions(transactions)
  const payload = buildExpenseAnalyzerPayload(comparison, transactions)
  const summary = buildExpenseAnalyzerSummary(payload)

  assert(payload.categoryBreakdown.length >= 2, 'Expected multiple categories')
  assert(payload.topMover != null || payload.categoryBreakdown.length > 0, 'Top mover or categories')
  assert(payload.overallSpending.currentTotal > 0, 'Overall spending current total')
  assert(typeof payload.narrativeSummary === 'string', 'Narrative summary should be a string')
  assert(summary.recurringCount === payload.recurringCharges.length, 'Summary recurring count')
  assert(Array.isArray(summary.recurringPreview), 'Summary includes recurring preview')
  console.log('  pass: full payload and summary helpers')
  passed++

  const dining = payload.categoryBreakdown.find((row) => row.category === 'Food and Drink')
  assert(dining?.percentOfTotal > 0, 'Category should include percentOfTotal')
  console.log('  pass: percentOfTotal on categories')
  passed++

  const subsCategory = payload.categoryBreakdown.find((row) => row.category === 'Subscriptions')
  assert((subsCategory?.recurringCharges?.length ?? 0) >= 1, 'Recurring charges linked to category')
  console.log('  pass: recurring charges attached to category rows')
  passed++

  const narrative = buildTemplateNarrative(payload)
  assert(narrative.includes('recurring'), 'Template narrative mentions recurring charges')
  console.log('  pass: template narrative generation')
  passed++

  const prompt = buildExpenseAnalyzerPromptBlock(payload)
  assert(prompt.block.includes('Pre-computed expense analyzer signals'), 'Prompt block present')
  assert(prompt.block.includes('Spotify'), 'Prompt includes recurring merchant')
  console.log('  pass: insight prompt block from expense context')
  passed++

  const emptyPayload = buildExpenseAnalyzerPayload(
    {
      hasComparisonData: false,
      currentPeriod: { spending: { total: 0, byCategory: {} }, income: { total: 0 } },
      priorPeriod: { spending: { total: 0, byCategory: {} }, income: { total: 0 } },
    },
    []
  )
  assert(emptyPayload.categoryBreakdown.length === 0, 'Empty transactions -> empty breakdown')
  assert(emptyPayload.topMover === null, 'Empty payload -> null top mover')
  console.log('  pass: new-user empty payload')
  passed++

  const charges = detectRecurringChargesFromTransactions([
    tx('GYM', 30, daysAgo(10), 'Health'),
    tx('GYM', 50, daysAgo(40), 'Health'),
  ])
  assert(charges.length === 0, 'Volatile amounts rejected')
  console.log('  pass: amount tolerance still enforced')
  passed++

  const flatTransactions = [
    tx('Coffee Shop', 50, daysAgo(5), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(12), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(18), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(25), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(35), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(42), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(48), 'Uncategorized'),
    tx('Coffee Shop', 50, daysAgo(56), 'Uncategorized'),
  ]
  const flatComparison = buildComparisonFromTransactions(flatTransactions)
  assert(flatComparison.hasComparisonData === true, 'flat fixture has enough history for comparison')
  const flatPayload = buildExpenseAnalyzerPayload(flatComparison, flatTransactions)

  assert(flatPayload.topMover === null, 'Flat categories should not produce a top mover')
  assert(
    flatPayload.narrativeSummary?.includes('steady across all categories'),
    'Flat spending uses steady category copy'
  )
  assert(
    !flatPayload.narrativeSummary?.includes('biggest mover'),
    'No biggest-mover framing when change is flat'
  )
  console.log('  pass: flat categories avoid contradictory top-mover copy')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
})
