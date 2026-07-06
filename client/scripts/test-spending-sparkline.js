/*
 * Verifies spending sparkline series filling and geometry helpers.
 *
 * Usage: node scripts/test-spending-sparkline.js
 */

import {
  buildSparklineGeometry,
  fillSpendingSeries,
  formatSparklineTotal,
} from '../src/lib/spendingSparkline.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Spending sparkline tests\n')

  const filled = fillSpendingSeries(
    [
      { date: '2026-07-04', amount: 10 },
      { date: '2026-07-06', amount: 25 },
    ],
    '7d'
  )

  assert(filled.length === 7, '7d range should produce 7 points')
  assert(filled[0].amount === 0, 'Missing days should be zero-filled')
  assert(filled.some((row) => row.amount === 25), 'Should preserve sparse amount')
  console.log('  pass: fillSpendingSeries zero-fills gaps')
  passed++

  const geometry = buildSparklineGeometry([0, 10, 5, 20])
  assert(geometry.coords.length === 4, 'Geometry should include all coordinates')
  assert(geometry.line.includes(','), 'Line path should be built')
  assert(geometry.area.includes(','), 'Area path should be built')
  console.log('  pass: buildSparklineGeometry')
  passed++

  assert(formatSparklineTotal([10, 5, 2.5]) === 17.5, 'Total should sum values')
  console.log('  pass: formatSparklineTotal')
  passed++

  console.log(`\n${passed}/${passed} spending sparkline tests passed.`)
} catch (err) {
  console.error(`\nTest failed: ${err.message}`)
  process.exit(1)
}
