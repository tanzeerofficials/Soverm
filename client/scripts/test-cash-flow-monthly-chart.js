/*
 * Verifies cash flow monthly paired-bar chart geometry.
 *
 * Usage: node scripts/test-cash-flow-monthly-chart.js
 */

import {
  buildCashFlowMonthlyGeometry,
  hasAnyCashFlowMonthlyData,
} from '../src/lib/cashFlowMonthlyChart.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Cash flow monthly chart tests\n')

  assert(buildCashFlowMonthlyGeometry([]) === null, 'Empty months returns null')
  console.log('  pass: empty input returns null')
  passed++

  const months = [
    { monthKey: '2026-05', monthLabel: "May '26", moneyIn: 1000, moneyOut: 800 },
    { monthKey: '2026-06', monthLabel: "Jun '26", moneyIn: 1200, moneyOut: 1200 },
    { monthKey: '2026-07', monthLabel: "Jul '26", moneyIn: 900, moneyOut: 400 },
  ]

  const geometry = buildCashFlowMonthlyGeometry(months)
  assert(geometry.bars.length === 3, 'One bar pair per month')
  assert(geometry.bars[0].monthKey === '2026-05', 'Bars keep month order (oldest first)')
  assert(geometry.max === 1200, 'Max is the largest single in/out value across months')

  const tallestBar = geometry.bars.find((bar) => bar.monthKey === '2026-06')
  assert(
    Math.abs(tallestBar.inHeight - tallestBar.outHeight) < 0.01,
    'Equal in/out in the same month should render equal bar heights'
  )
  assert(
    tallestBar.inHeight > geometry.bars[0].outHeight,
    'The month at max value should have a taller bar than a smaller month'
  )

  for (const bar of geometry.bars) {
    assert(bar.outX > bar.inX, 'Out bar sits to the right of the in bar within a group')
    assert(bar.barWidth > 0, 'Bar width is positive')
  }
  console.log('  pass: buildCashFlowMonthlyGeometry scales and orders bars correctly')
  passed++

  assert(hasAnyCashFlowMonthlyData(months) === true, 'Detects real data')
  assert(
    hasAnyCashFlowMonthlyData([{ monthKey: '2026-07', moneyIn: 0, moneyOut: 0 }]) === false,
    'All-zero months report no data'
  )
  assert(hasAnyCashFlowMonthlyData([]) === false, 'Empty array reports no data')
  console.log('  pass: hasAnyCashFlowMonthlyData')
  passed++

  console.log(`\n${passed}/${passed} cash flow monthly chart tests passed.`)
} catch (err) {
  console.error(`\nTest failed: ${err.message}`)
  process.exit(1)
}
