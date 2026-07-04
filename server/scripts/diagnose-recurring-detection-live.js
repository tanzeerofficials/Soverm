/*
 * Run recurring detection against live DB rows and report why each merchant matches.
 *
 * Usage: node scripts/diagnose-recurring-detection-live.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const dbModule = await import('../db/index.js')
const db = dbModule.pool ?? dbModule.default
const { detectRecurringChargesFromTransactions } = await import('../utils/expenseAnalyzerData.js')
const {
  isExcludedFromRecurringDetection,
  matchesExcludedRecurringName,
  isNoisyRecurringCategory,
  merchantSuggestsSubscription,
} = await import('../utils/recurringChargeFilters.js')
const { normalizeMerchantName } = await import('../utils/merchantNormalize.js')

const result = await db.query(
  `SELECT name, amount, date, category, pending
   FROM transactions
   WHERE amount > 0
     AND (pending IS NOT TRUE)
     AND date >= NOW() - INTERVAL '3 months'
   ORDER BY date ASC`
)

console.log('Live recurring detection diagnosis\n')
console.log(`Loaded ${result.rows.length} spending rows from DB\n`)

for (const row of result.rows.slice(0, 5)) {
  console.log('Sample row:', {
    name: row.name,
    category: row.category,
    excluded: isExcludedFromRecurringDetection(row),
    excludedName: matchesExcludedRecurringName(row.name),
    merchantKey: normalizeMerchantName(row.name),
  })
}

const detected = detectRecurringChargesFromTransactions(result.rows)
console.log(`\nDetected ${detected.length} recurring charges:\n`)
for (const charge of detected) {
  console.log(JSON.stringify(charge, null, 2))
}

const targets = ['SPARKFUN', 'CREDIT CARD', 'MCDONALD', 'UBER']
console.log('\n=== Per-target exclusion check ===')
for (const target of targets) {
  const rows = result.rows.filter((row) => row.name.toUpperCase().includes(target))
  const uniqueNames = [...new Set(rows.map((r) => r.name))]
  console.log(`\n${target}:`)
  console.log(`  rows: ${rows.length}, names: ${uniqueNames.join(' | ')}`)
  for (const name of uniqueNames) {
    console.log(`  excluded(${name}): ${matchesExcludedRecurringName(name)}`)
  }
  console.log(`  noisy category (null→Uncategorized): ${isNoisyRecurringCategory(null)}`)
  console.log(`  subscription keyword: ${uniqueNames.map((n) => merchantSuggestsSubscription(n)).join(', ')}`)
}

process.exit(0)
