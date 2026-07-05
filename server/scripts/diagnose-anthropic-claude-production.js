/*
 * Full-history ground truth + pipeline trace for Replit / Anthropic / Claude.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' node scripts/diagnose-anthropic-claude-production.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const dbModule = await import('../db/index.js')
const db = dbModule.pool ?? dbModule.default
const { normalizeMerchantName } = await import('../utils/merchantNormalize.js')
const { detectRecurringChargesFromTransactions } = await import('../utils/expenseAnalyzerData.js')
const { buildExpenseAnalyzerPayload, buildComparisonFromTransactions } = await import(
  '../utils/expenseAnalyzerData.js'
)

const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatDate(value) {
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }

  return value.toISOString().slice(0, 10)
}

function daysBetween(earlier, later) {
  const start = new Date(formatDate(earlier))
  const end = new Date(formatDate(later))
  start.setHours(12, 0, 0, 0)
  end.setHours(12, 0, 0, 0)
  return Math.round((end - start) / MS_PER_DAY)
}

function printRows(label, rows) {
  console.log(`\n=== ${label} (${rows.length} rows) ===\n`)
  console.log('date       | amount  | category              | raw merchant name')
  console.log('-----------|---------|----------------------|' + '-'.repeat(60))

  for (const row of rows) {
    const category = row.category ?? 'NULL'
    console.log(
      `${formatDate(row.date)} | $${String(row.amount).padEnd(5)} | ${String(category).padEnd(20)} | ${row.name}`
    )
  }
}

function printNormalizedGroups(rows) {
  const byKey = new Map()

  for (const row of rows) {
    const key = normalizeMerchantName(row.name)
    const list = byKey.get(key) ?? []
    list.push(row)
    byKey.set(key, list)
  }

  console.log('\n=== Normalized merchant groups ===\n')

  for (const [key, group] of byKey) {
    const sorted = [...group].sort((a, b) => new Date(a.date) - new Date(b.date))
    const uniqueDates = [...new Set(sorted.map((row) => formatDate(row.date)))]
    const uniqueAmounts = [...new Set(sorted.map((row) => Number(row.amount)))]
    const uniqueRawNames = [...new Set(sorted.map((row) => row.name))]
    const gaps = []

    for (let index = 1; index < uniqueDates.length; index++) {
      gaps.push(daysBetween(uniqueDates[index - 1], uniqueDates[index]))
    }

    console.log(`Key: ${key}`)
    console.log(`  raw descriptor variants: ${uniqueRawNames.length}`)
    for (const raw of uniqueRawNames) {
      console.log(`    - ${raw}`)
    }
    console.log(`  unique charge dates: ${uniqueDates.join(', ')}`)
    console.log(`  amounts: ${uniqueAmounts.map((amount) => '$' + amount).join(', ')}`)
    console.log(`  day gaps between unique dates: ${gaps.length ? gaps.join(', ') : '(n/a)'}`)
    console.log('')
  }
}

async function queryMerchantRows(pattern) {
  const result = await db.query(
    `SELECT name, amount, date, category, pending
     FROM transactions
     WHERE amount > 0
       AND (pending IS NOT TRUE)
       AND name ILIKE $1
     ORDER BY date ASC, name ASC`,
    [pattern]
  )

  return result.rows
}

const anthropicRows = await queryMerchantRows('%anthropic%')
const claudeRows = await queryMerchantRows('%claude%')
const replitRows = await queryMerchantRows('%replit%')

const anthropicClaudeRows = [...anthropicRows, ...claudeRows]
  .filter(
    (row, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.name === row.name &&
          formatDate(candidate.date) === formatDate(row.date) &&
          Number(candidate.amount) === Number(row.amount)
      ) === index
  )
  .sort((left, right) => new Date(left.date) - new Date(right.date))

printRows('Anthropic / Claude — full history', anthropicClaudeRows)
printNormalizedGroups(anthropicClaudeRows)
printRows('Replit — full history', replitRows)
printNormalizedGroups(replitRows)

const lookback = await db.query(
  `SELECT name, amount, date, category, pending
   FROM transactions
   WHERE amount > 0
     AND (pending IS NOT TRUE)
     AND date >= NOW() - INTERVAL '3 months'
   ORDER BY date ASC`
)

const payload = buildExpenseAnalyzerPayload(
  buildComparisonFromTransactions(lookback.rows),
  lookback.rows
)

console.log('\n=== Expense Analyzer payload (3-month lookback) ===\n')
console.log(
  'Confirmed recurring:',
  payload.recurringCharges.map(
    (charge) => `${charge.merchant} $${charge.averageAmount} (${charge.occurrenceCount} hits, ${charge.confidence})`
  )
)
console.log(
  'Review:',
  payload.reviewCharges.map(
    (charge) => `${charge.merchant} $${charge.averageAmount} (${charge.occurrenceCount} hits, ${charge.confidence})`
  )
)

const detected = detectRecurringChargesFromTransactions(lookback.rows)
const saas = detected.filter((charge) => /replit|anthropic|claude/i.test(charge.merchant))
console.log('\n=== Raw detectRecurringChargesFromTransactions (SaaS) ===')
for (const charge of saas) {
  console.log(JSON.stringify(charge, null, 2))
}

process.exit(0)
