/*
 * Diagnose Replit / Anthropic / Claude recurring charge detection.
 *
 * Usage: node scripts/diagnose-saas-subscriptions.js
 */

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbModule = await import('../db/index.js')
const db = dbModule.pool ?? dbModule.default
const { normalizeMerchantName } = await import('../utils/merchantNormalize.js')
const {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
  merchantSuggestsSubscription,
} = await import('../utils/recurringChargeFilters.js')
const { detectRecurringChargesFromTransactions } = await import('../utils/expenseAnalyzerData.js')

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(earlier, later) {
  const start = new Date(earlier)
  const end = new Date(later)
  start.setHours(12, 0, 0, 0)
  end.setHours(12, 0, 0, 0)
  return Math.round((end - start) / MS_PER_DAY)
}

function amountsAreIdentical(amounts) {
  const cents = amounts.map((amount) => Math.round(Number(amount) * 100))
  return cents.every((value) => value === cents[0])
}

function analyzeMerchant(name, rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const amounts = sorted.map((row) => Number(row.amount))
  const gaps = []

  for (let index = 1; index < sorted.length; index++) {
    gaps.push(daysBetween(sorted[index - 1].date, sorted[index].date))
  }

  const identicalAmounts = amountsAreIdentical(amounts)
  const tightMonthlyGaps =
    gaps.length >= 2 && gaps.every((gap) => gap >= 28 && gap <= 31)
  const strictMonthlyGaps =
    gaps.length >= 2 && gaps.every((gap) => gap >= 27 && gap <= 33)

  return {
    name,
    merchantKey: normalizeMerchantName(name),
    count: sorted.length,
    amounts: [...new Set(amounts)],
    categories: [...new Set(sorted.map((row) => row.category ?? 'NULL'))],
    dates: sorted.map((row) =>
      typeof row.date === 'string' ? row.date.slice(0, 10) : row.date.toISOString().slice(0, 10)
    ),
    gaps,
    excluded: isExcludedFromRecurringDetection(sorted[0]),
    coincidental: isCoincidentalMerchantName(name),
    subscriptionKeyword: merchantSuggestsSubscription(name),
    identicalAmounts,
    tightMonthlyGaps,
    strictMonthlyGaps,
    meetsIdenticalFallback:
      sorted.length >= 3 && identicalAmounts && tightMonthlyGaps,
    meetsKeywordPath:
      merchantSuggestsSubscription(name) &&
      sorted.length >= 2 &&
      strictMonthlyGaps,
  }
}

const merchantResult = await db.query(
  `SELECT name, amount, date, category, pending
   FROM transactions
   WHERE amount > 0
     AND (pending IS NOT TRUE)
     AND date >= NOW() - INTERVAL '3 months'
     AND (
       name ILIKE '%replit%'
       OR name ILIKE '%anthropic%'
       OR name ILIKE '%claude%'
     )
   ORDER BY name, date ASC`
)

const allSpending = await db.query(
  `SELECT name, amount, date, category, pending
   FROM transactions
   WHERE amount > 0
     AND (pending IS NOT TRUE)
     AND date >= NOW() - INTERVAL '3 months'
   ORDER BY date ASC`
)

console.log('SaaS subscription diagnosis (Replit / Anthropic / Claude)\n')
console.log(`Matching merchant rows in last 3 months: ${merchantResult.rows.length}\n`)

if (merchantResult.rows.length === 0) {
  console.log('No transactions found — Sovrn may not have synced these charges yet.')
  process.exit(0)
}

const byExactName = new Map()
for (const row of merchantResult.rows) {
  const list = byExactName.get(row.name) ?? []
  list.push(row)
  byExactName.set(row.name, list)
}

const byNormalizedKey = new Map()
for (const row of merchantResult.rows) {
  const key = normalizeMerchantName(row.name)
  const list = byNormalizedKey.get(key) ?? []
  list.push(row)
  byNormalizedKey.set(key, list)
}

console.log('=== Grouped by normalized merchant key ===\n')
for (const [key, rows] of byNormalizedKey) {
  const analysis = analyzeMerchant(key, rows)
  console.log(`Key: ${key}`)
  console.log(`  raw name variants: ${[...new Set(rows.map((row) => row.name))].length}`)
  console.log(`  occurrences (deduped view uses normalized key): ${analysis.count}`)
  console.log(`  dates: ${analysis.dates.join(', ')}`)
  console.log(`  amounts: ${analysis.amounts.map((a) => '$' + a).join(', ')}`)
  console.log(`  day gaps: ${analysis.gaps.length ? analysis.gaps.join(', ') : '(n/a)'}`)
  console.log(`  meets keyword path: ${analysis.meetsKeywordPath}`)
  console.log('')
}

console.log('=== Per raw bank descriptor ===\n')
for (const analysis of [...byExactName.values()].map((rows) =>
  analyzeMerchant(rows[0].name, rows)
)) {
  console.log(`=== ${analysis.name} ===`)
  console.log(`  occurrences: ${analysis.count}`)
  console.log(`  dates: ${analysis.dates.join(', ')}`)
  console.log(`  amounts: ${analysis.amounts.map((a) => '$' + a).join(', ')}`)
  console.log(`  categories: ${analysis.categories.join(', ')}`)
  console.log(
    `  day gaps: ${analysis.gaps.length ? analysis.gaps.join(', ') : '(n/a — single charge)'}`
  )
  console.log(`  excluded (payment/transfer): ${analysis.excluded}`)
  console.log(`  coincidental denylist: ${analysis.coincidental}`)
  console.log(`  subscription keyword: ${analysis.subscriptionKeyword}`)
  console.log(`  identical amounts: ${analysis.identicalAmounts}`)
  console.log(`  tight 28-31 day gaps: ${analysis.tightMonthlyGaps}`)
  console.log(
    `  meets identical-amount fallback (3+, identical, 28-31d): ${analysis.meetsIdenticalFallback}`
  )
  console.log(
    `  meets keyword path (2+, 27-33d, 5% tolerance): ${analysis.meetsKeywordPath}`
  )
  console.log('')
}

const detected = detectRecurringChargesFromTransactions(allSpending.rows)
const saasDetected = detected.filter((charge) =>
  /replit|anthropic|claude/i.test(charge.merchant)
)

console.log('=== Detected in full 3-month run ===')
if (saasDetected.length === 0) {
  console.log('  (none)')
} else {
  for (const charge of saasDetected) {
    console.log(JSON.stringify(charge, null, 2))
  }
}

process.exit(0)
