/**
 * Unit tests for monthly tracker helpers.
 * Run: node scripts/test-monthly-trackers.js
 */

import {
  computeSavingTrackerProgress,
  computeSpendingTrackerProgress,
  parseCreateTrackerInput,
} from '../utils/monthlyTrackers.js'
import { normalizeLegacyBudgetSnapshot } from '../services/trackerSnapshot.js'

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

const saving = computeSavingTrackerProgress(
  { monthlyAmount: 300, progressAmount: 120, targetTotal: 1200 },
  { income: 4000, spent: 2500 }
)
assert(saving.percentOfMonthly === 40, 'saving monthly percent')
assert(saving.paceEstimate === 1500, 'pace estimate')

const parsed = parseCreateTrackerInput({
  trackType: 'spending',
  monthlyAmount: 1500,
})
assert(parsed.value.trackType === 'spending', 'parses spending tracker')

const legacy = normalizeLegacyBudgetSnapshot({
  configured: true,
  monthlyBudget: 1500,
  spentThisMonth: 900,
  safeToSpend: 600,
  periodLabel: 'Jul 1–today',
  goals: [
    {
      id: 'goal-1',
      name: 'Emergency fund',
      purposeType: 'future',
      monthlyAmount: 300,
      savedSoFar: 120,
      active: true,
    },
  ],
})
assert(legacy.spendingTracker != null, 'legacy maps spending tracker')
assert(legacy.savingTrackers.length === 1, 'legacy maps saving trackers')
assert(legacy.trackers.length === 2, 'legacy builds combined tracker list')

console.log('All monthlyTrackers tests passed.')
