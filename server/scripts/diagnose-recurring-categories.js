/*
 * Diagnose actual category values for recurring-charge false positives.
 *
 * Usage: node scripts/diagnose-recurring-categories.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const dbModule = await import('../db/index.js')
const db = dbModule.pool ?? dbModule.default

const MERCHANT_PATTERNS = [
  { label: 'SparkFun', pattern: '%SPARKFUN%' },
  { label: 'Credit card payment', pattern: '%CREDIT CARD%PAYMENT%' },
  { label: "McDonald's", pattern: '%MCDONALD%' },
  { label: 'Uber', pattern: '%UBER%' },
]

console.log('Recurring charge category diagnosis\n')

for (const { label, pattern } of MERCHANT_PATTERNS) {
  const result = await db.query(
    `SELECT name, category, amount, date, pending, user_id
     FROM transactions
     WHERE UPPER(name) LIKE UPPER($1)
     ORDER BY date DESC
     LIMIT 20`,
    [pattern]
  )

  console.log(`=== ${label} (${result.rows.length} rows) ===`)

  if (result.rows.length === 0) {
    console.log('  (no matching transactions in database)\n')
    continue
  }

  const categories = new Set(
    result.rows.map((row) => (row.category == null ? '(null)' : `"${row.category}"`))
  )

  console.log(`  distinct category values: ${[...categories].join(', ')}`)

  for (const row of result.rows) {
    console.log(
      `  ${row.date} | $${row.amount} | category=${row.category ?? 'NULL'} | pending=${row.pending} | ${row.name}`
    )
  }

  console.log('')
}

const nullCategoryCount = await db.query(
  `SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE category IS NULL OR TRIM(category) = '')::int AS null_category
   FROM transactions
   WHERE amount > 0`
)
console.log('=== Overall spending category coverage ===')
console.log(
  `  ${nullCategoryCount.rows[0].null_category}/${nullCategoryCount.rows[0].total} spending rows have NULL/empty category`
)

process.exit(0)
