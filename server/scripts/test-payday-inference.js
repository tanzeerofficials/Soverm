/*
 * Unit tests for payday inference (no DB).
 */

import {
  advancePaydayToFuture,
  inferPaydayFromDeposits,
} from '../utils/paydayInference.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function deposit(date, amount) {
  // Plaid income is negative
  return { date, amount: -Math.abs(amount) }
}

console.log('paydayInference tests\n')

const weekly = inferPaydayFromDeposits(
  [
    deposit('2026-05-01', 1200),
    deposit('2026-05-08', 1200),
    deposit('2026-05-15', 1200),
    deposit('2026-05-22', 1200),
    deposit('2026-05-29', 1200),
  ],
  { referenceDate: new Date('2026-05-30T15:00:00Z') }
)

assert(weekly?.payCadence === 'weekly', `expected weekly, got ${weekly?.payCadence}`)
assert(weekly?.nextPaydayOn >= '2026-05-30', 'next payday should be on/after today')
assert(weekly.sampleCount >= 3, 'weekly sample count')

const biweekly = inferPaydayFromDeposits(
  [
    deposit('2026-03-06', 2000),
    deposit('2026-03-20', 2000),
    deposit('2026-04-03', 2000),
    deposit('2026-04-17', 2000),
    deposit('2026-05-01', 2000),
  ],
  { referenceDate: new Date('2026-05-05T15:00:00Z') }
)

assert(biweekly?.payCadence === 'biweekly', `expected biweekly, got ${biweekly?.payCadence}`)

const monthly = inferPaydayFromDeposits(
  [
    deposit('2026-01-15', 3500),
    deposit('2026-02-15', 3500),
    deposit('2026-03-15', 3500),
    deposit('2026-04-15', 3500),
  ],
  { referenceDate: new Date('2026-04-20T15:00:00Z') }
)

assert(monthly?.payCadence === 'monthly', `expected monthly, got ${monthly?.payCadence}`)

const weak = inferPaydayFromDeposits(
  [deposit('2026-05-01', 50), deposit('2026-05-03', 75)],
  { referenceDate: new Date('2026-05-10T15:00:00Z') }
)
assert(weak === null, 'weak signal should return null')

const advanced = advancePaydayToFuture('2026-05-01', 'weekly', '2026-05-20')
assert(advanced >= '2026-05-20', `stale payday should advance, got ${advanced}`)

console.log('All paydayInference tests passed.')
