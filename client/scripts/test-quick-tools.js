/**
 * Unit tests for quick tools helpers.
 * Run: node scripts/test-quick-tools.js
 */

import {
  assessAccountHealth,
  collectRecentTransactions,
  formatRelativeSync,
  QUICK_TOOL_TABS,
} from '../src/lib/quickTools.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const now = Date.now()
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString()

console.log('quickTools tests\n')

assert(QUICK_TOOL_TABS.RECENT === 'recent', 'recent tab id')
assert(QUICK_TOOL_TABS.TRACKER === 'tracker', 'tracker tab id')
assert(QUICK_TOOL_TABS.SPEND === 'spend', 'spend tab id')

const transactions = collectRecentTransactions([
  {
    category: 'Food',
    displayCategory: 'Food & Drink',
    recentTransactions: [
      { name: 'Coffee Shop', date: '2026-07-01', amount: 5.5 },
      { name: 'Grocery', date: '2026-07-03', amount: 42.1 },
    ],
  },
  {
    category: 'Travel',
    recentTransactions: [{ name: 'Airline', date: '2026-07-02', amount: 220 }],
  },
])

assert(transactions.length === 3, 'collects transactions across categories')
assert(transactions[0].name === 'Grocery', 'sorts newest first')
assert(transactions[0].category === 'Food & Drink', 'uses display category label')

const health = assessAccountHealth(
  [
    {
      id: 1,
      bank_name: 'Chase',
      account_name: 'Checking',
      account_type: 'depository',
      displayBalance: 1200,
    },
    {
      id: 2,
      bank_name: 'Amex',
      account_name: 'Credit',
      account_type: 'credit',
      displayBalance: 400,
    },
  ],
  hoursAgo(30)
)

assert(health.syncStale === true, 'flags stale sync')
assert(health.warningCount === 1, 'flags credit balance owed')
assert(health.accountStatuses[1].status === 'warning', 'credit warning status')

const freshSyncLabel = formatRelativeSync(hoursAgo(0.5))
assert(freshSyncLabel === 'Synced recently', 'recent sync label')

console.log('All quickTools tests passed.')
