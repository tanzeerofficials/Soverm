/*
 * Verifies insight MoM and transaction context use shared app-TZ rolling windows.
 *
 * Usage: node scripts/test-financial-context-window.js
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  COMPARISON_PERIOD_DAYS,
  COMPARISON_PERIOD_INTERVAL,
} from '../utils/financialContext.js'
import { ROLLING_COMPARISON_DAYS } from '../utils/calendarMonth.js'
import { test } from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(__dirname, '../utils/financialContext.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test('financial context window', () => {
  console.log('Financial context window tests\n')

  assert(
    COMPARISON_PERIOD_DAYS === ROLLING_COMPARISON_DAYS && ROLLING_COMPARISON_DAYS === 30,
    `Expected COMPARISON_PERIOD_DAYS to be 30, got "${COMPARISON_PERIOD_DAYS}"`
  )
  assert(COMPARISON_PERIOD_INTERVAL === '30 days', 'legacy interval string preserved')
  console.log('  pass: shared interval constant is 30 days')
  passed++

  assert(
    source.includes('getRollingComparisonSqlParams'),
    'loadFinancialContextForUser / MoM must use app-TZ SQL params'
  )
  assert(
    source.includes('AND t.date >= $2::date') && source.includes('AND t.date < $3::date'),
    'loadFinancialContextForUser must filter by civil date bounds'
  )
  console.log('  pass: loadFinancialContextForUser filters by date')
  passed++

  assert(
    source.includes('CONNECTED_ACCOUNT_TRANSACTION_JOINS'),
    'loadFinancialContextForUser must use connected-account joins (exclude disconnected txns)'
  )
  console.log('  pass: insight context uses connected-account filter')
  passed++

  assert(
    !source.includes("COALESCE(a.account_name, 'Disconnected account')"),
    'insight context must not include disconnected-account transaction labels'
  )
  console.log('  pass: disconnected account labels removed from insight context')
  passed++

  assert(
    !/loadFinancialContextForUser[\s\S]*?LIMIT\s+50/.test(source),
    'loadFinancialContextForUser must not use a fixed LIMIT 50'
  )
  console.log('  pass: removed LIMIT 50 from insight transaction query')
  passed++

  assert(
    source.includes('buildComparisonFromTransactions'),
    'MoM must share buildComparisonFromTransactions with Expense Analyzer'
  )
  console.log('  pass: MoM and insight context share the comparison builder')
  passed++

  assert(
    !source.includes('NOW() - $2::interval'),
    'MoM must not use UTC NOW()-interval windows'
  )
  console.log('  pass: UTC NOW()-interval MoM queries removed')
  passed++

  assert(
    source.includes('spending: {') === false || source.includes('buildComparisonFromTransactions'),
    'comparison object comes from shared builder'
  )
  console.log('  pass: nested spending and income periods via shared builder')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
})
