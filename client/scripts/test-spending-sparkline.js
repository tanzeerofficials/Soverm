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

function localDateKey(daysAgo) {
  const day = new Date()
  day.setHours(12, 0, 0, 0)
  day.setDate(day.getDate() - daysAgo)
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

let passed = 0

try {
  console.log('Spending sparkline tests\n')

  const sparseDate = localDateKey(2)
  const filled = fillSpendingSeries(
    [
      { date: sparseDate, amount: 25 },
      { date: localDateKey(5), amount: 10 },
    ],
    '7d'
  )

  assert(filled.length === 7, '7d range should produce 7 points')
  assert(
    filled.some((row) => row.amount === 0),
    'Missing days should be zero-filled'
  )
  assert(
    filled.some((row) => row.date === sparseDate && row.amount === 25),
    'Should preserve sparse amount on the correct local date'
  )
  assert(
    formatSparklineTotal(filled.map((row) => row.amount)) === 35,
    'Filled series total should match sparse amounts'
  )
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
