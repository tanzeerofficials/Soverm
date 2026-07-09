/**
 * Unit tests for monthly tracker helpers.
 * Run: node scripts/test-monthly-trackers.js
 */

import {
  computeMonthlyProgressUpdate,
  computeSavingTrackerProgress,
  computeSpendingTrackerProgress,
  parseCreateTrackerInput,
  resolveMonthlySaved,
} from '../utils/monthlyTrackers.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('monthlyTrackers tests\n')

const spending = computeSpendingTrackerProgress({ monthlyAmount: 1500 }, 900)
assert(spending.remaining === 600, 'spending remaining')
assert(spending.status === 'on_track', 'spending on track')

const over = computeSpendingTrackerProgress({ monthlyAmount: 1500 }, 1700)
assert(over.isOver === true, 'spending over cap')

const july = new Date(2026, 6, 15)
const saving = computeSavingTrackerProgress(
  {
    trackType: 'saving',
    monthlyAmount: 300,
    progressAmount: 450,
    monthlyProgressAmount: 120,
    progressMonth: '2026-07-01',
    targetTotal: 1200,
  },
  { income: 4000, spent: 2500, referenceDate: july }
)
assert(saving.savedThisMonth === 120, 'saving monthly amount')
assert(saving.totalSaved === 450, 'saving lifetime total')
assert(saving.percentOfMonthly === 40, 'saving monthly percent')
assert(saving.percentOfTotal === 38, 'saving total percent')
assert(saving.paceEstimate === 1500, 'pace estimate')

const staleMonth = computeSavingTrackerProgress(
  {
    trackType: 'saving',
    monthlyAmount: 300,
    progressAmount: 450,
    monthlyProgressAmount: 200,
    progressMonth: '2026-06-01',
    targetTotal: 1200,
  },
  { referenceDate: july }
)
assert(staleMonth.savedThisMonth === 0, 'stale month reads as zero monthly')
assert(staleMonth.totalSaved === 450, 'stale month keeps lifetime total')

assert(resolveMonthlySaved({
  trackType: 'saving',
  monthlyProgressAmount: 75,
  progressMonth: '2026-07-01',
}, july) === 75, 'resolve monthly saved for current month')

const progressUpdate = computeMonthlyProgressUpdate(
  {
    trackType: 'saving',
    progressAmount: 450,
    monthlyProgressAmount: 120,
    progressMonth: '2026-07-01',
  },
  150,
  july
)
assert(progressUpdate.monthlyProgressAmount === 150, 'updates monthly saved')
assert(progressUpdate.progressAmount === 480, 'adds monthly delta to lifetime total')
assert(progressUpdate.progressMonth === '2026-07-01', 'keeps current progress month')

const parsed = parseCreateTrackerInput({
  trackType: 'spending',
  monthlyAmount: 1500,
})
assert(parsed.value.trackType === 'spending', 'parses spending tracker')

console.log('All monthlyTrackers tests passed.')
