/*
 * Unit tests for what's left until payday.
 */

import { computeWhatsLeftUntilPayday } from '../utils/whatsLeftUntilPayday.js'
import { test } from 'node:test'

test('whats left until payday', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('whatsLeftUntilPayday tests\n')

  const unconfigured = computeWhatsLeftUntilPayday({
    netBalance: 1000,
    referenceDate: new Date('2026-05-10T15:00:00Z'),
  })
  assert(unconfigured.configured === false, 'unconfigured without payday')
  assert(unconfigured.amount === null, 'amount null when unconfigured')

  const zeroBills = computeWhatsLeftUntilPayday({
    netBalance: 800,
    nextPaydayOn: '2026-05-15',
    payCadence: 'biweekly',
    recurringCharges: [],
    referenceDate: new Date('2026-05-10T15:00:00Z'),
  })
  assert(zeroBills.configured === true, 'configured with payday')
  assert(zeroBills.amount === 800, `expected 800, got ${zeroBills.amount}`)
  assert(zeroBills.billsUntilPaydayTotal === 0, 'no bills')

  const withBills = computeWhatsLeftUntilPayday({
    netBalance: 1000,
    nextPaydayOn: '2026-05-20',
    payCadence: 'biweekly',
    recurringCharges: [
      {
        merchant: 'Rent',
        averageAmount: 400,
        cadence: 'monthly',
        nextExpectedDate: '2026-05-15',
      },
      {
        merchant: 'Netflix',
        averageAmount: 15.99,
        cadence: 'monthly',
        nextExpectedDate: '2026-05-12',
      },
    ],
    referenceDate: new Date('2026-05-10T15:00:00Z'),
  })
  assert(withBills.bills.length === 2, `expected 2 bills, got ${withBills.bills.length}`)
  assert(withBills.billsUntilPaydayTotal === 415.99, `bills total ${withBills.billsUntilPaydayTotal}`)
  assert(withBills.amount === 584.01, `whats left ${withBills.amount}`)

  const overBills = computeWhatsLeftUntilPayday({
    netBalance: 100,
    nextPaydayOn: '2026-05-20',
    payCadence: 'weekly',
    recurringCharges: [
      {
        merchant: 'Rent',
        averageAmount: 500,
        cadence: 'monthly',
        nextExpectedDate: '2026-05-12',
      },
    ],
    referenceDate: new Date('2026-05-10T15:00:00Z'),
  })
  assert(overBills.amount === 0, 'whats left floors at 0 when bills exceed balance')

  const withBuffer = computeWhatsLeftUntilPayday({
    netBalance: 500,
    nextPaydayOn: '2026-05-20',
    payCadence: 'weekly',
    bufferReserve: 50,
    recurringCharges: [],
    referenceDate: new Date('2026-05-10T15:00:00Z'),
  })
  assert(withBuffer.amount === 450, `buffer subtracts, got ${withBuffer.amount}`)

  console.log('All whatsLeftUntilPayday tests passed.')
})
