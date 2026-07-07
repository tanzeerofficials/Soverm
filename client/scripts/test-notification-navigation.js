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

console.log('All notificationNavigation tests passed.')
