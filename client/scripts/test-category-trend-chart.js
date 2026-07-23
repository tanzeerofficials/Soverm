/*
 * Verifies category trend mini-chart geometry.
 *
 * Usage: node scripts/test-category-trend-chart.js
 */

import { buildCategoryTrendGeometry } from '../src/lib/categoryTrendChart.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Category trend chart tests\n')

  assert(buildCategoryTrendGeometry([]) === null, 'Empty months returns null')
  console.log('  pass: empty input returns null')
  passed++

  const months = [
    { monthKey: '2026-05', monthLabel: "May '26", total: 0 },
    { monthKey: '2026-06', monthLabel: "Jun '26", total: 50 },
    { monthKey: '2026-07', monthLabel: "Jul '26", total: 100 },
  ]

  const geometry = buildCategoryTrendGeometry(months)
  assert(geometry.bars.length === 3, 'One bar per month')
  assert(geometry.max === 100, 'Max is the largest month total')
  assert(geometry.bars[2].isLast === true, 'Last bar is flagged for the current-month highlight')
  assert(geometry.bars[0].isLast === false, 'Earlier bars are not flagged as last')

  assert(
    geometry.bars[2].height > geometry.bars[1].height,
    'A larger total renders a taller bar than a smaller one'
  )
  assert(geometry.bars[0].height > 0, 'A zero-spend month still renders a visible sliver, not a gap')

  for (let i = 1; i < geometry.bars.length; i++) {
    assert(geometry.bars[i].x > geometry.bars[i - 1].x, 'Bars are laid out left to right in order')
  }
  console.log('  pass: buildCategoryTrendGeometry scales, orders, and flags the current month')
  passed++

  const allZero = buildCategoryTrendGeometry([
    { monthKey: '2026-07', monthLabel: "Jul '26", total: 0 },
  ])
  assert(allZero.bars[0].height === 1, 'All-zero data still returns a minimal renderable bar')
  console.log('  pass: all-zero months degrade gracefully instead of collapsing')
  passed++

  console.log(`\n${passed}/${passed} category trend chart tests passed.`)
} catch (err) {
  console.error(`\nTest failed: ${err.message}`)
  process.exit(1)
}
