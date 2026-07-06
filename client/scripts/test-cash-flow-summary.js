import { computeCashFlowMetrics } from '../src/lib/cashFlowSummary.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

console.log('Cash flow summary tests\n')

{
  const metrics = computeCashFlowMetrics(5000, 3200)
  assert(metrics.net === 1800, 'net should be income minus spent')
  assert(metrics.netIsPositive === true, 'positive net when income exceeds spent')
  assert(metrics.spendPercent === 64, 'spend percent rounds correctly')
  console.log('  pass: surplus cash flow')
  passed++
}

{
  const metrics = computeCashFlowMetrics(2000, 2500)
  assert(metrics.net === -500, 'net should be negative when overspent')
  assert(metrics.netIsPositive === false, 'netIsPositive false when overspent')
  assert(metrics.spendPercent === 100, 'spend ratio capped at 100% when spent exceeds income')
  console.log('  pass: deficit cash flow caps spend bar at 100%')
  passed++
}

{
  const metrics = computeCashFlowMetrics(0, 800)
  assert(metrics.spendRatio === null, 'no spend ratio without income')
  assert(metrics.spendPercent === null, 'no spend percent without income')
  console.log('  pass: zero income skips ratio')
  passed++
}

console.log(`\n${passed}/${passed} cash flow summary tests passed.`)
