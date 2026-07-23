/*
 * Verifies proactive notification trigger rules and templates.
 *
 * Usage: node scripts/test-proactive-notifications.js
 */

import 'dotenv/config'
import {
  buildTemplateNotificationCopy,
  detectLargeTransactionTriggers,
  detectLowBalanceTrigger,
  detectNewRecurringChargeTriggers,
  detectSpendingCapTriggers,
  detectSpendingSpikeTriggers,
  evaluateProactiveTriggers,
  LARGE_TRANSACTION_MIN_ABSOLUTE,
  SPENDING_SPIKE_PERCENT,
} from '../utils/proactiveNotificationRules.js'
import { test } from 'node:test'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test('proactive notifications', () => {
  console.log('Proactive notification tests\n')

  const large = detectLargeTransactionTriggers({
    recentTransactions: [
      { id: '1', name: 'Best Buy', amount: 650, date: '2026-07-06', category: 'Shopping' },
      { id: '2', name: 'Coffee', amount: 5, date: '2026-07-06', category: 'Food' },
      { id: '3', name: 'Coffee', amount: 6, date: '2026-07-05', category: 'Food' },
    ],
  })
  assert(large.length === 1, 'Should detect $650 as large transaction')
  assert(large[0].facts.amount === 650, 'Large transaction amount should be 650')
  console.log('  pass: large transaction detection')
  passed++

  const lowBalance = detectLowBalanceTrigger({
    accounts: [
      {
        account_type: 'depository',
        balance_current: 200,
        balance_available: 200,
      },
    ],
    monthOverMonth: {
      currentPeriod: { spending: { total: 3000 } },
    },
  })
  assert(lowBalance.length === 1, 'Should detect low runway')
  assert(lowBalance[0].facts.runwayDays < 4, 'Runway should be under 4 days')
  console.log('  pass: low balance detection')
  passed++

  const recurring = detectNewRecurringChargeTriggers({
    recurringCharges: [
      {
        merchant: 'SparkFun',
        monthlyEquivalent: 89.4,
        category: 'Shopping',
        occurrenceCount: 3,
        lastChargedDate: '2026-07-01',
      },
    ],
    previouslyNotifiedMerchants: new Set(),
  })
  assert(recurring.length === 1, 'Should detect new recurring SparkFun')
  assert(recurring[0].dedupKey === 'merchant:sparkfun', 'Dedup key should use merchant')
  console.log('  pass: new recurring detection')
  passed++

  const recurringSkipped = detectNewRecurringChargeTriggers({
    recurringCharges: [
      {
        merchant: 'SparkFun',
        monthlyEquivalent: 89.4,
        occurrenceCount: 3,
        lastChargedDate: '2026-07-01',
      },
    ],
    previouslyNotifiedMerchants: new Set(['sparkfun']),
  })
  assert(recurringSkipped.length === 0, 'Should skip already-notified merchant')
  console.log('  pass: recurring dedup merchant memory')
  passed++

  const spike = detectSpendingSpikeTriggers({
    categoryBreakdown: [
      {
        category: 'Dining',
        currentTotal: 700,
        priorTotal: 400,
        delta: { direction: 'up', percent: 75 },
      },
      {
        category: 'Shopping',
        currentTotal: 100,
        priorTotal: 95,
        delta: { direction: 'up', percent: 5 },
      },
    ],
  })
  assert(spike.length === 1, 'Should detect dining spike only')
  assert(spike[0].facts.percent >= SPENDING_SPIKE_PERCENT, 'Spike should meet threshold')
  console.log('  pass: spending spike detection')
  passed++

  const capOver = detectSpendingCapTriggers({
    spendingTracker: {
      id: 'tracker-1',
      name: 'Monthly spending',
      monthlyAmount: 1500,
      progress: { spent: 1600, isOver: true, overBy: 100, percentUsed: 107 },
    },
    periodStart: '2026-07-01',
  })
  assert(capOver.length === 1, 'Should detect spending cap over')
  assert(capOver[0].triggerType === 'spending_cap_over', 'Over cap trigger type')
  console.log('  pass: spending cap over detection')
  passed++

  const capWarning = detectSpendingCapTriggers({
    spendingTracker: {
      id: 'tracker-1',
      name: 'Monthly spending',
      monthlyAmount: 1500,
      progress: { spent: 1250, isOver: false, remaining: 250, percentUsed: 83 },
    },
    periodStart: '2026-07-01',
  })
  assert(capWarning.length === 1, 'Should detect spending cap warning')
  assert(capWarning[0].triggerType === 'spending_cap_warning', 'Warning cap trigger type')
  console.log('  pass: spending cap warning detection')

  const dollarWarning = detectSpendingCapTriggers({
    spendingTracker: {
      id: 'cap-1',
      name: 'Monthly spending',
      monthlyAmount: 1500,
      alertRemainingDollars: 200,
      progress: { spent: 1320, isOver: false, remaining: 180, percentUsed: 88 },
    },
    periodStart: '2026-07-01',
  })
  assert(dollarWarning.length === 1, 'Should detect dollar remaining warning')
  console.log('  pass: spending cap dollar threshold detection')

  const customQuiet = detectSpendingCapTriggers({
    spendingTracker: {
      id: 'cap-1',
      name: 'Monthly spending',
      monthlyAmount: 1500,
      alertWarningPercent: 90,
      progress: { spent: 1250, isOver: false, remaining: 250, percentUsed: 83 },
    },
    periodStart: '2026-07-01',
  })
  assert(customQuiet.length === 0, 'Custom 90% should not warn at 83%')
  console.log('  pass: custom percent threshold quiet below line')
  passed++

  const evaluated = evaluateProactiveTriggers({
    accounts: [
      { account_type: 'depository', balance_current: 100, balance_available: 100 },
    ],
    monthOverMonth: { currentPeriod: { spending: { total: 3000 } } },
    categoryBreakdown: [
      {
        category: 'Dining',
        currentTotal: 700,
        priorTotal: 400,
        delta: { direction: 'up', percent: 75 },
      },
    ],
    recurringCharges: [],
    recentTransactions: [
      { id: '9', name: 'Store', amount: LARGE_TRANSACTION_MIN_ABSOLUTE + 1, date: '2026-07-06' },
    ],
    previouslyNotifiedMerchants: new Set(),
  })
  assert(evaluated[0].triggerType === 'low_balance', 'Low balance should rank first')
  console.log('  pass: trigger priority ordering')
  passed++

  const template = buildTemplateNotificationCopy(recurring[0])
  assert(template.title.includes('subscription'), 'Template title should mention subscription')
  assert(template.body.includes('SparkFun'), 'Template body should mention merchant')
  console.log('  pass: template copy fallback')
  passed++

  console.log(`\n${passed}/${passed} proactive notification tests passed.`)
})
