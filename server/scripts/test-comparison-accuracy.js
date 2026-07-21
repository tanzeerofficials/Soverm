/*
 * Accuracy lock-in for comparison math + cash-flow filters.
 *
 * Tone/copy changes must never change the underlying numbers.
 * Run: node --test scripts/test-comparison-accuracy.js
 */

import { test } from 'node:test'

import {
  computeSpendingDelta,
  formatComparisonPhrase,
  formatMoneyAmount,
  formatTimesMultiplier,
} from '../utils/financialContext.js'
import {
  isCashFlowIncomeRow,
  isCashFlowSpendingRow,
  isInternalMoveTransaction,
  summarizeCashFlow,
} from '../utils/transactionFilters.js'
import { enforceStatDeltas } from '../services/claude.js'
import { calculateTotalBalance } from '../utils/balanceHelpers.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function nearlyEqual(left, right, tolerance = 0.001) {
  return Math.abs(left - right) <= tolerance
}

/** Same 2-decimal contract as computeSpendingDelta's stored times field. */
function expectedTimes(current, prior) {
  return Math.round((current / prior) * 100) / 100
}

let passed = 0

test("comparison + filter accuracy", () => {
  console.log('Comparison + filter accuracy tests\n')

  // 1) Hand-calculated dining example used across the codebase
  {
    const current = 842
    const prior = 712
    const delta = computeSpendingDelta(current, prior)

    assert(delta.direction === 'up', 'dining direction')
    assert(delta.percent === 18, 'dining percent still hand-calculated ((842-712)/712)')
    assert(delta.times === expectedTimes(current, prior), 'dining times === round(current/prior, 2)')
    assert(nearlyEqual(delta.absoluteChange, current - prior), 'dining absoluteChange')
    assert(
      formatComparisonPhrase(current, prior, delta).includes('$842') &&
        formatComparisonPhrase(current, prior, delta).includes('$712') &&
        formatComparisonPhrase(current, prior, delta).includes('+$130'),
      'phrase keeps exact dollar amounts'
    )
    console.log('  pass: dining $842 vs $712 math + phrase')
    passed++
  }

  // 2) Extreme spike: percent is dramatic, times/dollars stay exact
  {
    const current = 887
    const prior = 100
    const delta = computeSpendingDelta(current, prior)

    assert(delta.percent === 787, 'spike percent preserved for thresholds')
    assert(delta.times === expectedTimes(current, prior), 'spike times === round(887/100, 2)')
    assert(delta.absoluteChange === 787, 'spike absoluteChange')
    assert(formatTimesMultiplier(delta.times) === '8.9×', 'display rounds times label only')
    assert(delta.times === 8.87, 'stored times stays at 2 decimals, not display-rounded to 8.9')
    console.log('  pass: spike keeps exact times/dollars (display may round label)')
    passed++
  }

  // 3) Decline
  {
    const current = 5200
    const prior = 5650
    const delta = computeSpendingDelta(current, prior)

    assert(delta.direction === 'down', 'income decline direction')
    assert(delta.times === expectedTimes(current, prior), 'decline times')
    assert(nearlyEqual(delta.absoluteChange, prior - current), 'decline absoluteChange')
    assert(
      formatComparisonPhrase(current, prior, delta).includes('−$450'),
      'decline phrase uses minus dollar change'
    )
    console.log('  pass: decline math')
    passed++
  }

  // 4) New category / zero prior
  {
    const delta = computeSpendingDelta(45, 0)
    assert(delta.isNewCategory === true, 'new category flag')
    assert(delta.percent === null, 'new category has no percent')
    assert(delta.times === null, 'new category has no times')
    assert(delta.absoluteChange === 45, 'new category absoluteChange is current total')
    console.log('  pass: new category edge case')
    passed++
  }

  // 4b) Sub-0.5% change stays flat but keeps real absoluteChange
  {
    const delta = computeSpendingDelta(1004, 1000)
    assert(delta.direction === 'flat', 'sub-0.5% is flat')
    assert(delta.percent === 0, 'sub-0.5% percent rounds to 0')
    assert(delta.absoluteChange === 4, 'flat branch keeps real absoluteChange')
    assert(
      formatComparisonPhrase(1004, 1000, delta).includes('$1,004') &&
        formatComparisonPhrase(1004, 1000, delta).includes('$1,000'),
      'flat phrase still shows both totals'
    )
    console.log('  pass: flat delta keeps absoluteChange ($1000 → $1004)')
    passed++
  }

  // 4c) Negatives format as -$N, not $-N
  {
    assert(formatMoneyAmount(-5) === '-$5', 'negative money uses leading minus')
    console.log('  pass: formatMoneyAmount negative sign')
    passed++
  }

  // 5) enforceStatDeltas overwrites invented Claude % with precomputed totals
  {
    const comparison = {
      hasComparisonData: true,
      currentPeriod: {
        spending: {
          total: 3287,
          byCategory: { Dining: 842 },
        },
        income: { total: 5200 },
      },
      priorPeriod: {
        spending: {
          total: 2797,
          byCategory: { Dining: 712 },
        },
        income: { total: 4800 },
      },
    }

    const enforced = enforceStatDeltas(
      {
        stats: [
          {
            label: 'Total Spend',
            value: '$3,287',
            detail: 'overall spending',
            delta: { direction: 'up', percent: 999, vsLabel: 'vs last month' },
          },
          {
            label: 'Dining',
            value: '$842',
            detail: 'food spend',
            delta: { direction: 'down', percent: 50 },
          },
        ],
      },
      comparison
    )

    const spend = enforced.stats[0].delta
    const dining = enforced.stats[1].delta

    assert(spend.percent === 18, 'enforced overall percent')
    assert(spend.currentTotal === 3287, 'enforced overall currentTotal')
    assert(spend.priorTotal === 2797, 'enforced overall priorTotal')
    assert(spend.times === expectedTimes(3287, 2797), 'enforced overall times')
    assert(spend.absoluteChange === 490, 'enforced overall absoluteChange')

    assert(dining.percent === 18, 'enforced dining percent')
    assert(dining.currentTotal === 842, 'enforced dining currentTotal')
    assert(dining.priorTotal === 712, 'enforced dining priorTotal')
    assert(dining.times === expectedTimes(842, 712), 'enforced dining times')
    assert(dining.absoluteChange === 130, 'enforced dining absoluteChange')
    console.log('  pass: enforceStatDeltas replaces invented % with exact precomputed fields')
    passed++
  }

  // 6) Filters: real spend/income kept; internal moves dropped
  {
    assert(
      isCashFlowSpendingRow({
        amount: 42.5,
        category: 'Food and Drink',
        name: 'Chipotle',
        date: '2026-07-01',
        pending: false,
      }),
      'real spend counts'
    )
    assert(
      isCashFlowIncomeRow({
        amount: -2500,
        category: 'Payroll',
        name: 'ACME PAYROLL',
        date: '2026-07-01',
        pending: false,
      }),
      'payroll income counts'
    )
    assert(
      isCashFlowIncomeRow({
        amount: -2000,
        category: 'Transfer',
        name: 'Zelle payment from Alex',
        date: '2026-07-01',
        pending: false,
      }),
      'Zelle received counts as income'
    )
    assert(
      isInternalMoveTransaction({
        amount: 500,
        category: 'Transfer',
        name: 'Transfer to Savings',
      }),
      'savings transfer excluded'
    )
    assert(
      isInternalMoveTransaction({
        amount: -200,
        category: 'Payment',
        name: 'Payment Thank You',
      }),
      'card payment credit excluded from income'
    )
    assert(
      !isCashFlowSpendingRow({
        amount: 200,
        category: 'Payment',
        name: 'CREDIT CARD AUTOPAY',
        date: '2026-07-01',
        pending: false,
      }),
      'card payment outflow excluded from spend'
    )
    assert(
      !isInternalMoveTransaction({
        amount: 18,
        category: 'Shops',
        name: 'Amazon',
      }),
      'normal Amazon spend not treated as internal'
    )
    console.log('  pass: filters keep real cash flow, drop internal moves')
    passed++
  }

  // 6b) Ledger summary: Zelle/payroll in moneyIn; savings/CC separate; Chipotle in moneyOut
  {
    const summary = summarizeCashFlow([
      {
        name: 'Zelle payment from Alex',
        category: 'Transfer',
        amount: -2000,
        date: '2026-07-10',
        pending: false,
      },
      {
        name: 'ACME PAYROLL',
        category: 'Payroll',
        amount: -3000,
        date: '2026-07-09',
        pending: false,
      },
      {
        name: 'Chipotle',
        category: 'Food and Drink',
        amount: 14,
        date: '2026-07-08',
        pending: false,
      },
      {
        name: 'Transfer to Savings',
        category: 'Transfer',
        amount: 500,
        date: '2026-07-07',
        pending: false,
      },
      {
        name: 'CREDIT CARD AUTOPAY',
        category: 'Payment',
        amount: 200,
        date: '2026-07-06',
        pending: false,
      },
    ])

    assert(summary.moneyIn === 5000, 'ledger moneyIn = Zelle + payroll')
    assert(summary.moneyOut === 14, 'ledger moneyOut = Chipotle only')
    assert(summary.internalMoved === 500, 'savings transfer not in moneyOut')
    assert(summary.liabilityPayments === 200, 'CC autopay not in moneyOut')
    assert(summary.byKind.peer_in === 2000, 'Zelle kind peer_in')
    assert(summary.byKind.income === 3000, 'payroll kind income')
    assert(summary.byKind.spend === 14, 'Chipotle kind spend')
    console.log('  pass: summarizeCashFlow money in/out vs internal/liability')
    passed++
  }

  // 7) Balance accuracy: liabilities subtract, cash adds
  {
    const total = calculateTotalBalance([
      { account_type: 'checking', balance_available: 2045.18, balance_current: 2100 },
      { account_type: 'credit card', balance_available: 1000, balance_current: 400 },
      { account_type: 'student', balance_available: null, balance_current: 5000 },
    ])
    assert(nearlyEqual(total, 2045.18 - 400 - 5000), 'net balance subtracts all liabilities')
    assert(formatMoneyAmount(2045.18) === '$2,045.18', 'money formatting preserves cents')
    console.log('  pass: balance netting + money formatting')
    passed++
  }

})
