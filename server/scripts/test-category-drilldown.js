/*
 * Verifies per-account category breakdown and drill-down helpers.
 *
 * Usage: node scripts/test-category-drilldown.js
 */

import 'dotenv/config'
import {
  buildCategoryAccountBreakdowns,
  buildCategoryDrillDownMaps,
} from '../utils/categoryBreakdownEnhancements.js'
import { buildComparisonFromTransactions, buildExpenseAnalyzerPayload } from '../utils/expenseAnalyzerData.js'
import { test } from 'node:test'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tx(name, amount, daysAgo, category, account) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)

  return {
    name,
    amount,
    date: date.toISOString().slice(0, 10),
    category,
    pending: false,
    account_id: account.id,
    account_name: account.name,
    bank_name: account.bankName,
  }
}

let passed = 0

test('category drilldown', () => {
  console.log('Category drill-down tests\n')

  const chase = { id: 'acc-1', name: 'Checking', bankName: 'Chase' }
  const amex = { id: 'acc-2', name: 'Gold Card', bankName: 'Amex' }

  const transactions = [
    tx('Chipotle', 40, 3, 'Food and Drink', chase),
    tx('Chipotle', 35, 8, 'Food and Drink', amex),
    tx('Whole Foods', 80, 5, 'Food and Drink', chase),
    tx('SPOTIFY', 10.99, 10, 'Subscriptions', chase),
    tx('SPOTIFY', 10.99, 40, 'Subscriptions', chase),
    tx('SPOTIFY', 10.99, 70, 'Subscriptions', chase),
  ]

  const accountBreakdowns = buildCategoryAccountBreakdowns(transactions)
  const foodAccounts = accountBreakdowns.get('Food and Drink') ?? []

  assert(foodAccounts.length === 2, 'Food category should split across two accounts')
  assert(foodAccounts[0].total >= foodAccounts[1].total, 'Accounts should be sorted by total')
  assert(foodAccounts.some((entry) => entry.label.includes('Chase')), 'Chase label present')
  console.log('  pass: per-account category breakdown')
  passed++

  const drillDowns = buildCategoryDrillDownMaps(transactions)
  const foodDrillDown = drillDowns.get('Food and Drink')

  assert((foodDrillDown?.topMerchants?.length ?? 0) >= 2, 'Top merchants should include Chipotle and Whole Foods')
  assert((foodDrillDown?.recentTransactions?.length ?? 0) >= 2, 'Recent transactions should be populated')
  console.log('  pass: category drill-down maps')
  passed++

  const comparison = buildComparisonFromTransactions(transactions)
  const payload = buildExpenseAnalyzerPayload(comparison, transactions)
  const foodCategory = payload.categoryBreakdown.find((entry) => entry.category === 'Food and Drink')

  assert((foodCategory?.accountBreakdown?.length ?? 0) === 2, 'Payload includes accountBreakdown')
  assert((foodCategory?.topMerchants?.length ?? 0) >= 1, 'Payload includes topMerchants')
  assert((foodCategory?.recentTransactions?.length ?? 0) >= 1, 'Payload includes recentTransactions')
  console.log('  pass: payload enrichment on category rows')
  passed++

  console.log(`\n${passed}/${passed} category drill-down tests passed.`)
})
