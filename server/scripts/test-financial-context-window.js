/*
 * Verifies insight transaction context uses the same 30-day window as MoM comparison.
 *
 * Usage: node scripts/test-financial-context-window.js
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { COMPARISON_PERIOD_INTERVAL } from '../utils/financialContext.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(__dirname, '../utils/financialContext.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Financial context window tests\n')

  assert(
    COMPARISON_PERIOD_INTERVAL === '30 days',
    `Expected COMPARISON_PERIOD_INTERVAL to be "30 days", got "${COMPARISON_PERIOD_INTERVAL}"`
  )
  console.log('  pass: shared interval constant is 30 days')
  passed++

  assert(
    source.includes('AND t.date >= NOW() - $2::interval'),
    'loadFinancialContextForUser must filter transactions by rolling date window'
  )
  console.log('  pass: loadFinancialContextForUser filters by date')
  passed++

  assert(
    !/loadFinancialContextForUser[\s\S]*?LIMIT\s+50/.test(source),
    'loadFinancialContextForUser must not use a fixed LIMIT 50'
  )
  console.log('  pass: removed LIMIT 50 from insight transaction query')
  passed++

  const momCurrentQueries = source.match(/date >= NOW\(\) - \$2::interval/g) ?? []
  assert(
    momCurrentQueries.length >= 3,
    'MoM spending/income current-period queries and insight context should use the same interval param'
  )
  console.log('  pass: MoM and insight context share the interval pattern')
  passed++

  assert(
    /amount\s*<\s*0/.test(source) && /SUM\(ABS\(/.test(source),
    'loadMonthOverMonthComparison must sum income using Plaid inflows (amount < 0)'
  )
  console.log('  pass: income comparison queries present')
  passed++

  assert(
    source.includes('spending: {') &&
      source.includes('income: {') &&
      source.includes('byCategory: buildCategoryTotals'),
    'comparison object must expose nested spending and income periods'
  )
  console.log('  pass: nested spending/income comparison shape')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
