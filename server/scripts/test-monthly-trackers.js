/**
 * Unit tests for monthly tracker helpers.
 * Run: node scripts/test-monthly-trackers.js
 */

import {
  computeMonthlyProgressUpdate,
  computeSavingTrackerProgress,
  computeSpendingTrackerProgress,
  isSpendingCapWarningActive,
  parseCreateTrackerInput,
  parseUpdateTrackerInput,
  resolveMonthlySaved,
  resolveSpendingAlertThresholds,
} from '../utils/monthlyTrackers.js'
import { test } from 'node:test'

test('monthly trackers', () => {
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

  const defaultWarning = computeSpendingTrackerProgress({ monthlyAmount: 1500 }, 1250)
  assert(defaultWarning.status === 'warning', 'default 80% warning')

  const customPercent = computeSpendingTrackerProgress(
    { monthlyAmount: 1500, alertWarningPercent: 90 },
    1250
  )
  assert(customPercent.status === 'on_track', 'custom 90% not yet warning at 83%')

  const customPercentHit = computeSpendingTrackerProgress(
    { monthlyAmount: 1500, alertWarningPercent: 90 },
    1360
  )
  assert(customPercentHit.status === 'warning', 'custom 90% warning when crossed')

  const dollarOnly = computeSpendingTrackerProgress(
    { monthlyAmount: 1500, alertRemainingDollars: 200 },
    1250
  )
  assert(dollarOnly.status === 'on_track', 'dollar threshold not hit at $250 left')

  const dollarHit = computeSpendingTrackerProgress(
    { monthlyAmount: 1500, alertRemainingDollars: 200 },
    1320
  )
  assert(dollarHit.status === 'warning', 'dollar threshold warning at $180 left')
  assert(
    isSpendingCapWarningActive(
      { alertRemainingDollars: 200 },
      { isOver: false, remaining: 180, percentUsed: 88 }
    ),
    'isSpendingCapWarningActive dollar rule'
  )

  const bothEither = resolveSpendingAlertThresholds({
    alertWarningPercent: 70,
    alertRemainingDollars: 300,
  })
  assert(bothEither.warningPercent === 70, 'both thresholds keep percent')
  assert(bothEither.remainingDollars === 300, 'both thresholds keep dollars')

  const createWithAlerts = parseCreateTrackerInput({
    trackType: 'spending',
    monthlyAmount: 2000,
    alertWarningPercent: 75,
    alertRemainingDollars: 250,
  })
  assert(!createWithAlerts.error, 'create spending with alerts parses')
  assert(createWithAlerts.value.alertWarningPercent === 75, 'create keeps percent')
  assert(createWithAlerts.value.alertRemainingDollars === 250, 'create keeps dollars')

  const updateClearAlerts = parseUpdateTrackerInput({
    alertWarningPercent: null,
    alertRemainingDollars: null,
  })
  assert(!updateClearAlerts.error, 'clearing alerts parses')
  assert(updateClearAlerts.value.alertWarningPercent === null, 'clears percent')
  assert(updateClearAlerts.value.alertRemainingDollars === null, 'clears dollars')

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
})
