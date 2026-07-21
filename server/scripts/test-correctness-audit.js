/**
 * Correctness-audit regression suite (node:test).
 *
 * Locks the five failure modes from the recurring/MoM correctness audit:
 *   1. variable-amount bill (tolerance retry after identical-cent clustering)
 *   2. merge collision (amount-similar ≠ same merchant)
 *   3. window symmetry (both MoM windows are 30 civil days)
 *   4. refund handling (same-merchant refund nets spend, not income)
 *   5. partial prior coverage (short history must not emit MoM deltas)
 *
 * Usage: node --test scripts/test-correctness-audit.js
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addCalendarDaysToIso,
  getAppTodayIso,
  getRollingComparisonWindow,
  isWithinAppDaysAgo,
  isWithinAppPriorPeriod,
  ROLLING_COMPARISON_DAYS,
} from '../utils/calendarMonth.js'
import { detectRecurringChargesFromTransactions } from '../utils/expenseAnalyzerData.js'
import { mergeRecurringCharges } from '../services/plaidRecurring.js'
import {
  buildComparisonFromTransactions,
  evaluateHasComparisonData,
  MIN_COMPARISON_HISTORY_DAYS,
  netSameMerchantRefunds,
} from '../utils/rollingComparison.js'

function tx(name, amount, date, category = 'Rent And Utilities') {
  return { name, amount, date, category, pending: false }
}

describe('correctness audit regressions', () => {
  test('variable-amount bill: $42.10/$43.85/$41.90 utility detected via tolerance retry', () => {
    const charges = detectRecurringChargesFromTransactions([
      tx('ConEd', 42.1, '2026-01-05'),
      tx('ConEd', 43.85, '2026-02-04'),
      tx('ConEd', 41.9, '2026-03-06'),
    ])

    assert.equal(charges.length, 1, 'variable utility within 5% should be detected')
    assert.equal(charges[0].firstAmount, 42.1)
    assert.equal(charges[0].lastAmount, 41.9)

    // McDonald's / Uber must stay blocked (identical cents alone is not enough)
    assert.equal(
      detectRecurringChargesFromTransactions([
        tx("McDonald's", 12, '2026-04-11', null),
        tx("McDonald's", 12, '2026-05-11', null),
        tx("McDonald's", 12, '2026-06-10', null),
      ]).length,
      0,
      "McDonald's false positive must stay blocked"
    )
    assert.equal(
      detectRecurringChargesFromTransactions([
        tx('Uber 072515 SF**POOL**', 6.33, '2026-04-27', null),
        tx('Uber 072515 SF**POOL**', 6.33, '2026-05-27', null),
        tx('Uber 072515 SF**POOL**', 6.33, '2026-06-26', null),
      ]).length,
      0,
      'Uber ride false positive must stay blocked'
    )
  })

  test('merge collision: Spotify $11.99 + Hulu $11.99 stay separate; Apple streams by amount', () => {
    const spotifyHeuristic = [
      {
        merchant: 'Spotify',
        category: 'Subscriptions',
        averageAmount: 11.99,
        firstAmount: 11.99,
        lastAmount: 11.99,
        cadence: 'monthly',
        occurrenceCount: 3,
        confidence: 'high',
        monthlyEquivalent: 11.99,
        source: 'heuristic',
        merchantKey: 'spotify',
        rawName: 'SPOTIFY',
      },
    ]
    const huluPlaid = [
      {
        merchant: 'Hulu',
        category: 'Subscriptions',
        averageAmount: 11.99,
        firstAmount: 11.99,
        lastAmount: 11.99,
        cadence: 'monthly',
        occurrenceCount: 6,
        confidence: 'high',
        monthlyEquivalent: 11.99,
        source: 'plaid',
        merchantKey: 'hulu',
        rawName: 'HULU',
        accounts: [],
        accountLabel: null,
        primaryAccount: null,
      },
    ]

    const crossMerchant = mergeRecurringCharges(spotifyHeuristic, huluPlaid)
    assert.equal(crossMerchant.length, 2, 'same-dollar streams must not merge across merchants')
    assert.ok(
      crossMerchant.every((charge) => charge.source !== 'both'),
      'amount-only match must not promote source to both'
    )

    const appleHeuristic = [
      {
        merchant: 'Apple',
        category: 'Subscriptions',
        averageAmount: 2.99,
        firstAmount: 2.99,
        lastAmount: 2.99,
        cadence: 'monthly',
        occurrenceCount: 3,
        confidence: 'medium',
        monthlyEquivalent: 2.99,
        source: 'heuristic',
        merchantKey: 'apple com bill',
        rawName: 'APPLE.COM/BILL',
      },
    ]
    const applePlaidTwins = [
      {
        merchant: 'iCloud',
        category: 'Subscriptions',
        averageAmount: 2.99,
        firstAmount: 2.99,
        lastAmount: 2.99,
        cadence: 'monthly',
        occurrenceCount: 6,
        confidence: 'high',
        monthlyEquivalent: 2.99,
        source: 'plaid',
        merchantKey: 'apple com bill',
        rawName: 'APPLE.COM/BILL',
        accounts: [],
        accountLabel: null,
        primaryAccount: null,
      },
      {
        merchant: 'Apple TV',
        category: 'Subscriptions',
        averageAmount: 9.99,
        firstAmount: 9.99,
        lastAmount: 9.99,
        cadence: 'monthly',
        occurrenceCount: 6,
        confidence: 'high',
        monthlyEquivalent: 9.99,
        source: 'plaid',
        merchantKey: 'apple com bill',
        rawName: 'APPLE.COM/BILL',
        accounts: [],
        accountLabel: null,
        primaryAccount: null,
      },
    ]

    const sameMerchant = mergeRecurringCharges(appleHeuristic, applePlaidTwins)
    assert.equal(sameMerchant.length, 2, 'distinct same-merchant amounts must not collapse')
    assert.ok(sameMerchant.some((c) => c.averageAmount === 2.99))
    assert.ok(sameMerchant.some((c) => c.averageAmount === 9.99))
  })

  test('window symmetry: current and prior are each 30 civil days (diff ∈ [0,29] / [30,59])', () => {
    const originalTz = process.env.APP_TIMEZONE
    process.env.APP_TIMEZONE = 'America/New_York'

    try {
      const reference = new Date('2026-07-15T16:00:00.000Z')
      const todayIso = getAppTodayIso(reference)
      assert.equal(todayIso, '2026-07-15')

      assert.equal(isWithinAppDaysAgo(todayIso, 30, reference), true)
      assert.equal(
        isWithinAppDaysAgo(addCalendarDaysToIso(todayIso, -29), 30, reference),
        true,
        'day 29 is still current'
      )
      assert.equal(
        isWithinAppDaysAgo(addCalendarDaysToIso(todayIso, -30), 30, reference),
        false,
        'day 30 starts prior — not a 31-day current window'
      )
      assert.equal(
        isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -30), 30, 60, reference),
        true
      )
      assert.equal(
        isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -59), 30, 60, reference),
        true
      )
      assert.equal(
        isWithinAppPriorPeriod(addCalendarDaysToIso(todayIso, -60), 30, 60, reference),
        false
      )

      const window = getRollingComparisonWindow(reference)
      assert.equal(window.days, ROLLING_COMPARISON_DAYS)
      assert.equal(window.days, 30)
      assert.equal(window.currentStartIso, addCalendarDaysToIso(todayIso, -29))
      assert.equal(window.priorStartIso, addCalendarDaysToIso(todayIso, -59))
      assert.equal(window.priorEndExclusiveIso, window.currentStartIso)
    } finally {
      if (originalTz === undefined) {
        delete process.env.APP_TIMEZONE
      } else {
        process.env.APP_TIMEZONE = originalTz
      }
    }
  })

  test('refund handling: $500 buy + same-merchant $500 refund nets to $0 spend, not income', () => {
    const originalTz = process.env.APP_TIMEZONE
    process.env.APP_TIMEZONE = 'America/New_York'

    try {
      const reference = new Date('2026-07-15T16:00:00.000Z')
      const todayIso = getAppTodayIso(reference)
      const spend = [
        { name: 'Amazon', amount: 500, category: 'Shops', date: todayIso, pending: false },
      ]
      const refund = [
        { name: 'Amazon', amount: -500, category: 'Shops', date: todayIso, pending: false },
      ]

      const netted = netSameMerchantRefunds(spend, refund)
      assert.equal(netted.spendingRows.length, 2)
      assert.equal(netted.incomeRows.length, 0)
      assert.equal(
        netted.spendingRows.reduce((sum, row) => sum + Number(row.amount), 0),
        0
      )

      const comparison = buildComparisonFromTransactions(
        [
          ...spend,
          ...refund,
          {
            name: 'Coffee',
            amount: 4,
            category: 'Food and Drink',
            date: addCalendarDaysToIso(todayIso, -35),
            pending: false,
          },
          {
            name: 'Coffee',
            amount: 4,
            category: 'Food and Drink',
            date: addCalendarDaysToIso(todayIso, -40),
            pending: false,
          },
          {
            name: 'Coffee',
            amount: 4,
            category: 'Food and Drink',
            date: addCalendarDaysToIso(todayIso, -45),
            pending: false,
          },
          {
            name: 'Coffee',
            amount: 4,
            category: 'Food and Drink',
            date: addCalendarDaysToIso(todayIso, -56),
            pending: false,
          },
        ],
        reference
      )
      assert.equal(comparison.currentPeriod.spending.total, 0)
      assert.equal(comparison.currentPeriod.income.total, 0)
    } finally {
      if (originalTz === undefined) {
        delete process.env.APP_TIMEZONE
      } else {
        process.env.APP_TIMEZONE = originalTz
      }
    }
  })

  test('partial prior coverage: 40 days of history must not emit MoM deltas', () => {
    const originalTz = process.env.APP_TIMEZONE
    process.env.APP_TIMEZONE = 'America/New_York'

    try {
      const reference = new Date('2026-07-15T16:00:00.000Z')
      const todayIso = getAppTodayIso(reference)
      const shortHistory = []
      for (let daysAgo = 0; daysAgo <= 40; daysAgo += 1) {
        shortHistory.push({
          name: 'Coffee',
          amount: 5,
          category: 'Food and Drink',
          date: addCalendarDaysToIso(todayIso, -daysAgo),
          pending: false,
        })
      }

      assert.equal(
        evaluateHasComparisonData(shortHistory, reference),
        false,
        `history < ${MIN_COMPARISON_HISTORY_DAYS} days must not emit deltas`
      )

      const comparison = buildComparisonFromTransactions(shortHistory, reference)
      assert.equal(comparison.hasComparisonData, false)
      assert.ok(
        comparison.currentPeriod.spending.total > 0,
        'current spend still exists — only the prior claim is gated'
      )
    } finally {
      if (originalTz === undefined) {
        delete process.env.APP_TIMEZONE
      } else {
        process.env.APP_TIMEZONE = originalTz
      }
    }
  })
})
