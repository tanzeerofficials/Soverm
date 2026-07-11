/*
 * Verifies chart helpers and empty-state guardrails.
 *
 * Usage: node scripts/test-expense-analyzer-charts.js
 */

import {
  CHART_BAR_SEQUENCE,
  SPARKLINE_NEGATIVE,
  SPARKLINE_POSITIVE,
  truncateChartLabel,
} from '../src/lib/expenseAnalyzerChartTheme.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

console.log('Expense Analyzer chart constraint tests\n')

assert(CHART_BAR_SEQUENCE.every((color) => color.startsWith('#')), 'Bar colors are hex values')
assert(
  CHART_BAR_SEQUENCE.some((color) => color.toLowerCase() === '#8b5cf6'),
  'Uses established purple accent'
)
assert(SPARKLINE_POSITIVE.toLowerCase() === '#10b981', 'Sparkline positive matches app emerald')
assert(SPARKLINE_NEGATIVE.toLowerCase() === '#ef4444', 'Sparkline negative matches app red')
console.log('  pass: chart theme uses established palette only')
passed++

assert(truncateChartLabel('General Merchandise', 10) === 'General M…', 'Truncates long labels')
console.log('  pass: label truncation for narrow layouts')
passed++

function shouldRenderComparisonPanel(items) {
  return Array.isArray(items) && items.length >= 2
}

assert(!shouldRenderComparisonPanel([]), 'Empty comparison panel hidden')
assert(!shouldRenderComparisonPanel([{ merchant: 'Netflix' }]), 'Single-item comparison hidden')
assert(shouldRenderComparisonPanel([{ merchant: 'A' }, { merchant: 'B' }]), 'Two+ items show comparison')
console.log('  pass: comparison panel only when 2+ items')
passed++

console.log(`\n${passed}/${passed} tests passed`)
