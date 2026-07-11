/**
 * Tests for notification deep-link resolution.
 * Run: node scripts/test-notification-navigation.js
 */

import {
  notificationActionLabel,
  parseNotificationRelatedData,
  resolveNotificationTarget,
} from '../src/lib/notificationNavigation.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('notificationNavigation tests\n')

assert(
  parseNotificationRelatedData('{"link":"/expense-analyzer"}').link === '/expense-analyzer',
  'parses JSON string related_data'
)

const lowBalance = resolveNotificationTarget({
  trigger_type: 'low_balance',
  related_data: { link: '/dashboard' },
})
assert(lowBalance.pathname === '/dashboard', 'low balance stays on dashboard')
assert(lowBalance.search.includes('focus=balance'), 'low balance focuses hero')

const recurring = resolveNotificationTarget({
  trigger_type: 'new_recurring_charge',
  related_data: { link: '/expense-analyzer' },
})
assert(recurring.search.includes('tab=recurring'), 'recurring opens recurring tab')

const spike = resolveNotificationTarget({
  trigger_type: 'spending_spike',
  related_data: { category: 'Food and Drink', link: '/expense-analyzer' },
})
assert(spike.search.includes('tab=categories'), 'spike opens categories tab')
assert(spike.search.includes('highlight=Food'), 'spike highlights category')

const largeTxn = resolveNotificationTarget({
  trigger_type: 'large_transaction',
  related_data: {},
})
assert(largeTxn.search.includes('tab=overview'), 'large transaction opens overview')

assert(
  notificationActionLabel({ trigger_type: 'new_recurring_charge' }) === 'View subscriptions',
  'action label for recurring'
)

const weekly = resolveNotificationTarget({
  trigger_type: 'weekly_truth_letter',
  related_data: { link: '/weekly-review', weekStartIso: '2026-07-06' },
})
assert(weekly.pathname === '/weekly-review', 'weekly truth letter opens Your week')
assert(
  notificationActionLabel({ trigger_type: 'weekly_truth_letter' }) === 'Open Your week',
  'weekly action label'
)

const monthLetter = resolveNotificationTarget({
  trigger_type: 'month_condition_ready',
  related_data: { monthKey: '2026-06', link: '/month-condition?month=2026-06' },
})
assert(monthLetter.pathname === '/month-condition', 'month letter path')
assert(monthLetter.search.includes('month=2026-06'), 'month letter query')
assert(
  notificationActionLabel({ trigger_type: 'month_condition_ready' }) === 'Read month letter',
  'month action label'
)

console.log('All notificationNavigation tests passed.')
