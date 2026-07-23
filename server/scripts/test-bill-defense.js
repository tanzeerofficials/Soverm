/*
 * Unit tests for bill / subscription defense heuristics.
 *
 * Usage: node --test scripts/test-bill-defense.js
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBillDefenseFindings,
  detectDuplicateRecurrings,
  detectLikelyTrial,
  detectNewRecurring,
  detectPriceIncrease,
} from '../utils/billDefense.js'
import {
  buildComparisonFromTransactions,
  buildExpenseAnalyzerPayload,
} from '../utils/expenseAnalyzerData.js'
import { mapPlaidStreamToRecurringCharge } from '../services/plaidRecurring.js'

function tx(name, amount, date, category = 'Subscriptions') {
  return { name, amount, date, category, pending: false }
}

describe('billDefense', () => {
  test('detects meaningful price increases and ignores flat / missing endpoints', () => {
    const hike = detectPriceIncrease({
      merchant: 'Netflix',
      firstAmount: 15.49,
      lastAmount: 22.99,
      occurrenceCount: 4,
      averageAmount: 18,
    })
    assert.equal(hike?.type, 'price_increase')
    assert.ok(hike.percentIncrease > 8)

    assert.equal(
      detectPriceIncrease({
        merchant: 'Spotify',
        firstAmount: 10.99,
        lastAmount: 10.99,
        occurrenceCount: 5,
      }),
      null
    )

    assert.equal(
      detectPriceIncrease({
        merchant: 'Plaid Only Avg',
        averageAmount: 20,
        occurrenceCount: 4,
      }),
      null,
      'missing first/last must not invent a hike from average'
    )
  })

  test('detects new recurring, trials, and duplicates', () => {
    const newbie = detectNewRecurring(
      {
        merchant: 'Cursor',
        occurrenceCount: 1,
        lastChargedDate: '2026-05-10',
        averageAmount: 20,
        monthlyEquivalent: 20,
        confidence: 'low',
      },
      { todayIso: '2026-05-15' }
    )
    assert.equal(newbie?.type, 'new_recurring')

    const trial = detectLikelyTrial(
      {
        merchant: 'Adobe Free Trial',
        firstAmount: 0.99,
        lastAmount: 54.99,
        occurrenceCount: 2,
        lastChargedDate: '2026-05-01',
        averageAmount: 28,
      },
      { todayIso: '2026-05-15' }
    )
    assert.equal(trial?.type, 'likely_trial')

    const dupes = detectDuplicateRecurrings([
      {
        merchant: 'Hulu',
        merchantKey: 'hulu',
        monthlyEquivalent: 17.99,
        averageAmount: 17.99,
        cadence: 'monthly',
      },
      {
        merchant: 'Hulu (Disney Bundle)',
        merchantKey: 'huludisneybundle',
        monthlyEquivalent: 19.99,
        averageAmount: 19.99,
        cadence: 'monthly',
      },
    ])
    assert.ok(dupes.length >= 1)
  })

  test('price hike survives buildExpenseAnalyzerPayload end-to-end', () => {
    const findings = buildBillDefenseFindings({
      recurringCharges: [
        {
          merchant: 'Netflix',
          firstAmount: 15,
          lastAmount: 23,
          occurrenceCount: 3,
          averageAmount: 19,
          monthlyEquivalent: 23,
          lastChargedDate: '2026-04-01',
        },
      ],
      reviewCharges: [],
      todayIso: '2026-05-15',
    })
    assert.ok(findings.some((f) => f.type === 'price_increase'))

    /*
     * End-to-end through buildExpenseAnalyzerPayload — not hand-built charge objects.
     * Why: synthetic firstAmount/lastAmount hid a bug where the real pipeline never
     * populated those fields, so price_increase never fired in production.
     */
    const hikeRows = [
      tx('NETFLIX.COM', 15.49, '2026-01-05'),
      tx('NETFLIX.COM', 15.49, '2026-02-04'),
      tx('NETFLIX.COM', 16.99, '2026-03-06'),
    ]
    const hikePayload = buildExpenseAnalyzerPayload(
      buildComparisonFromTransactions(hikeRows),
      hikeRows
    )
    const hikeFinding = hikePayload.billDefense.find((f) => f.type === 'price_increase')
    assert.ok(hikeFinding, 'price hike survives buildExpenseAnalyzerPayload end-to-end')
    assert.ok(hikeFinding.merchant.toLowerCase().includes('netflix'))
    assert.equal(hikeFinding.firstAmount, 15.49)
    assert.equal(hikeFinding.lastAmount, 16.99)
  })

  test('same-merchant one-off outlier does not fake a price hike', () => {
    /*
     * Regression: amount endpoints came from the raw merchant group, so a $4.99
     * gift-card charge dated before a flat $16.99 subscription reported
     * "Netflix got more expensive, 4.99 → 16.99 (+240%)".
     */
    const rows = [
      tx('NETFLIX.COM GIFT', 4.99, '2025-12-27'),
      tx('NETFLIX.COM', 16.99, '2026-01-05'),
      tx('NETFLIX.COM', 16.99, '2026-02-04'),
      tx('NETFLIX.COM', 16.99, '2026-03-06'),
    ]
    const payload = buildExpenseAnalyzerPayload(buildComparisonFromTransactions(rows), rows)

    assert.ok(
      !payload.billDefense.some((f) => f.type === 'price_increase'),
      'outlier one-off must not register as a price increase'
    )

    const netflix = [...payload.recurringCharges, ...payload.reviewCharges].find((c) =>
      c.merchant.toLowerCase().includes('netflix')
    )
    assert.ok(netflix, 'flat subscription still detected')
    assert.equal(netflix.firstAmount, 16.99)
    assert.equal(netflix.lastAmount, 16.99)
  })

  test('Plaid-mapped streams can trigger price increase from history endpoints', () => {
    const plaidMapped = mapPlaidStreamToRecurringCharge(
      {
        merchant_name: 'ConEd',
        description: 'ConEd Bill',
        frequency: 'MONTHLY',
        average_amount: { amount: 90 },
        last_amount: { amount: 100 },
        last_date: '2026-05-02',
        transaction_ids: ['a', 'b', 'c'],
        status: 'MATURE',
        account_id: 'acct',
      },
      new Map(),
      { firstAmount: 85, lastAmount: 100 }
    )
    assert.equal(plaidMapped.firstAmount, 85)
    assert.equal(plaidMapped.lastAmount, 100)
    assert.equal(detectPriceIncrease(plaidMapped)?.type, 'price_increase')
  })
})
