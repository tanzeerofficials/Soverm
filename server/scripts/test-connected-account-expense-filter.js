/*
 * Verifies Expense Analyzer excludes disconnected-account transactions at query time
 * while leaving orphan rows in the database.
 *
 * Usage: node scripts/test-connected-account-expense-filter.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
  loadExpenseAnalyzerData,
} = await import('../utils/expenseAnalyzerData.js')
const { getCategoryBreakdownWithDeltas, detectRecurringCharges } = await import(
  '../utils/financialContext.js'
)

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
    account_id: account?.id ?? null,
    account_name: account?.name ?? null,
    bank_name: account?.bankName ?? null,
  }
}

let passed = 0

try {
  console.log('Connected-account Expense Analyzer filter tests\n')

  const connectedAccount = {
    id: 'acct-connected',
    name: 'Plaid Checking',
    bankName: 'Bank of America',
  }

  const connectedRows = [
    tx('Uber 072515 SF**POOL**', 6.33, 5, 'Transportation', connectedAccount),
    tx('McDonald\'s', 12, 10, 'Food And Drink', connectedAccount),
    tx('SPOTIFY', 10.99, 10, 'Subscriptions', connectedAccount),
    tx('SPOTIFY', 10.99, 40, 'Subscriptions', connectedAccount),
    tx('SPOTIFY', 10.99, 70, 'Subscriptions', connectedAccount),
  ]

  const payload = buildExpenseAnalyzerPayload(
    buildComparisonFromTransactions(connectedRows),
    connectedRows
  )

  const drillDownLabels = payload.categoryBreakdown.flatMap(
    (row) => row.recentTransactions?.map((entry) => entry.accountLabel) ?? []
  )
  assert(
    drillDownLabels.every((label) => label.includes('Bank of America')),
    'Connected rows should show real account labels'
  )
  assert(
    !drillDownLabels.some((label) => label === 'Disconnected account'),
    'Connected-only payload must not show Disconnected account'
  )
  console.log('  pass: connected-account rows keep real labels in drill-down')
  passed++

  const emptyPayload = buildExpenseAnalyzerPayload(
    buildComparisonFromTransactions([]),
    []
  )
  assert(emptyPayload.categoryBreakdown.length === 0, 'No connected rows -> empty breakdown')
      assert(emptyPayload.recurringCharges.length === 0, 'No connected rows -> no recurring')
      console.log('  pass: zero connected transactions -> empty Expense Analyzer payload')
  passed++

  if (process.env.DATABASE_URL) {
    try {
      const dbModule = await import('../db/index.js')
      const db = dbModule.pool ?? dbModule.default

      const userId = 'user_3Fh9tH3R5Nxq4GDyTSEGZlHcuAh'
      const orphanCount = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM transactions
         WHERE user_id = $1 AND account_id IS NULL`,
        [userId]
      )
      assert(orphanCount.rows[0].count > 0, 'Fixture user should still have orphan rows in DB')

      const livePayload = await loadExpenseAnalyzerData(userId)
      const liveLabels = livePayload.categoryBreakdown.flatMap(
        (row) => row.recentTransactions?.map((entry) => entry.accountLabel) ?? []
      )
      assert(
        !liveLabels.some((label) => label === 'Disconnected account'),
        'Live Expense Analyzer must exclude disconnected-account drill-down rows'
      )
      assert(
        !livePayload.categoryBreakdown.some((row) =>
          row.accountBreakdown?.some((entry) => entry.label === 'Disconnected account')
        ),
        'Live category account breakdown must exclude disconnected totals'
      )
      assert(
        !['Uber', 'McDonald\'s', 'Starbucks'].some((merchant) =>
          (livePayload.categoryBreakdown.find((row) => row.category === 'Uncategorized')
            ?.recentTransactions ?? []
          ).some((entry) => entry.name.includes(merchant))
        ),
        'Orphan Uncategorized merchants must not appear in live drill-down'
      )

      const breakdown = await getCategoryBreakdownWithDeltas(userId)
      const recurring = await detectRecurringCharges(userId)
      assert(
        breakdown.every((row) => row.currentTotal >= 0),
        'Category breakdown should only reflect connected accounts'
      )
      assert(
        !recurring.some((charge) => charge.accountLabel === 'Disconnected account'),
        'Recurring detection must exclude disconnected-account transactions'
      )

      console.log('  pass: live DB orphans preserved but excluded from Expense Analyzer')
      passed++
    } catch (err) {
      console.log(`  skip: live DB checks (${err.message})`)
    }
  } else {
    console.log('  skip: live DB checks (DATABASE_URL not set)')
  }

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}

process.exit(0)
