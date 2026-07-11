/*
 * Unit tests for bill / subscription defense heuristics.
 */

import {
  buildBillDefenseFindings,
  detectDuplicateRecurrings,
  detectLikelyTrial,
  detectNewRecurring,
  detectPriceIncrease,
} from '../utils/billDefense.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('billDefense tests\n')

const hike = detectPriceIncrease({
  merchant: 'Netflix',
  firstAmount: 15.49,
  lastAmount: 22.99,
  occurrenceCount: 4,
  averageAmount: 18,
})
assert(hike?.type === 'price_increase', 'price hike')
assert(hike.percentIncrease > 8, 'percent')

const noHike = detectPriceIncrease({
  merchant: 'Spotify',
  firstAmount: 10.99,
  lastAmount: 10.99,
  occurrenceCount: 5,
})
assert(noHike === null, 'flat price')

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
assert(newbie?.type === 'new_recurring', 'new recurring')

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
assert(trial?.type === 'likely_trial', 'trial')

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
assert(dupes.length >= 1, 'duplicate pair')

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
assert(findings.some((f) => f.type === 'price_increase'), 'findings include hike')

console.log('All billDefense tests passed.')
