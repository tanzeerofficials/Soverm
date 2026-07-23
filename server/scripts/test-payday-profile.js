/*
 * PAYDAY PROFILE MAPPING TESTS
 *
 * Regression: pg returns users.next_payday_on (DATE) as a JS Date object.
 * mapProfile stringified it — "Sun Aug 02 2026 …".slice(0, 10) = "Sun Aug 02" —
 * so daysUntilPayday was null and the dashboard hero rendered
 * "null days until Sun Aug 02" for every configured-payday user.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mapProfile } from '../services/payday.js'

function isoDaysAhead(n, reference) {
  const d = new Date(reference)
  d.setDate(d.getDate() + n)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

describe('mapProfile date handling', () => {
  const referenceDate = new Date(2026, 6, 22, 12, 0, 0) // local noon, stable

  test('pg Date object for next_payday_on maps to ISO + integer days', () => {
    const payday = new Date(2026, 7, 2) // pg DATE => local midnight Aug 2
    const profile = mapProfile(
      {
        pay_cadence: 'biweekly',
        next_payday_on: payday,
        payday_source: 'user',
        payday_updated_at: new Date(),
      },
      referenceDate
    )

    assert.equal(profile.configured, true)
    assert.equal(profile.nextPaydayOn, '2026-08-02')
    assert.equal(profile.daysUntilPayday, 11)
  })

  test('ISO string next_payday_on still works', () => {
    const profile = mapProfile(
      {
        pay_cadence: 'biweekly',
        next_payday_on: isoDaysAhead(11, referenceDate),
        payday_source: 'user',
        payday_updated_at: new Date(),
      },
      referenceDate
    )

    assert.equal(profile.nextPaydayOn, '2026-08-02')
    assert.equal(profile.daysUntilPayday, 11)
  })

  test('unconfigured rows stay null across the board', () => {
    const profile = mapProfile(
      { pay_cadence: null, next_payday_on: null, payday_source: null, payday_updated_at: null },
      referenceDate
    )

    assert.equal(profile.configured, false)
    assert.equal(profile.nextPaydayOn, null)
    assert.equal(profile.daysUntilPayday, null)
  })
})
