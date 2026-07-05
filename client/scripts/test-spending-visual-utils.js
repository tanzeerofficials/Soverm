/*
 * Tests for spending visual slice preparation.
 *
 * Usage: node scripts/test-spending-visual-utils.js
 */

import {
  buildArcSegments,
  formatPercent,
  prepareDonutSlices,
  prepareRecurringSlices,
} from '../src/lib/spendingVisualUtils.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

console.log('Spending visual utils tests\n')

const breakdown = prepareDonutSlices([
  { category: 'Shopping', currentTotal: 90 },
  { category: 'Dining', currentTotal: 30 },
  { category: 'Travel', currentTotal: 20 },
])

assert(breakdown.total === 140, 'Totals add up')
assert(breakdown.slices[0].label === 'Shopping', 'Largest category first')
assert(breakdown.slices[0].percent > breakdown.slices[1].percent, 'Sorted by share')
console.log('  pass: category donut slices sorted by spend')
passed++

const recurring = prepareRecurringSlices([
  { merchant: 'SparkFun', averageAmount: 89.4, lastChargedDate: '2026-01-01' },
  { merchant: 'Spotify', averageAmount: 10, lastChargedDate: '2026-01-02' },
])

assert(recurring.total === 99.4, 'Recurring total computed')
assert(recurring.slices.length === 2, 'Recurring slices preserved')
assert(recurring.slices[0].label === 'SparkFun', 'Merchant name used as legend label')
console.log('  pass: recurring donut slices')
passed++

const arcs = buildArcSegments(breakdown.slices)
assert(arcs.length === breakdown.slices.length, 'Arc per slice')
assert(arcs[0].endAngle > arcs[0].startAngle, 'Arc has sweep')
console.log('  pass: arc segment geometry')
passed++

assert(formatPercent(0.4) === '<1%', 'Tiny percent formatted')
assert(formatPercent(62.84) === '62.8%', 'Percent rounded')
console.log('  pass: percent formatting')
passed++

console.log(`\n${passed}/${passed} tests passed`)
