/*
 * Verifies insight display helpers used by InsightCard and chat polish.
 *
 * Usage: node scripts/test-insight-display.js
 */

import {
  buildDeltaAriaLabel,
  buildQuickQuestions,
  compactDeltaToneClass,
  formatCompactDelta,
  formatInsightSnapshotFootnote,
  selectHistoryPreviewStats,
  toneForChange,
} from '../src/lib/insightDisplay.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

try {
  console.log('Insight display helper tests\n')

  const footnote = formatInsightSnapshotFootnote({
    created_at: '2026-07-02T17:06:41.913Z',
    metadata: {
      generatedAt: '2026-07-02T13:06:00.000Z',
      transactionCount: 47,
      comparisonWindow: '30d',
    },
  })

  assert(footnote.includes('Based on 47 transactions'), 'footnote missing transaction count')
  assert(footnote.includes('rolling 30-day window'), 'footnote missing window label')
  console.log('  pass: metadata footnote includes transaction count and window')

  const legacyFootnote = formatInsightSnapshotFootnote({
    created_at: '2026-07-02T17:06:41.913Z',
  })

  assert(legacyFootnote && !legacyFootnote.includes('Based on'), 'legacy footnote should omit transaction count')
  console.log('  pass: legacy insights still show generated date footnote')

  assert(
    buildDeltaAriaLabel(
      {
        direction: 'up',
        percent: 18,
        times: 1.18,
        absoluteChange: 142,
        currentTotal: 842,
        priorTotal: 700,
      },
      'income'
    ) === 'Income $842 this period, up from $700 in the prior 30 days',
    'income aria-label incorrect'
  )
  assert(
    buildDeltaAriaLabel({ direction: 'flat', percent: 0 }, 'spending') ===
      'Spending unchanged vs prior 30 days',
    'flat aria-label incorrect'
  )
  console.log('  pass: delta aria-labels')

  const momQuestions = buildQuickQuestions({
    stats: [
      {
        label: 'Dining',
        value: '$842',
        delta: {
          direction: 'up',
          percent: 18,
          times: 1.18,
          absoluteChange: 142,
          currentTotal: 842,
          priorTotal: 700,
        },
      },
      {
        label: 'Monthly Income',
        value: '$5,200',
        delta: {
          direction: 'down',
          percent: 8,
          times: 0.92,
          absoluteChange: 450,
          currentTotal: 5200,
          priorTotal: 5650,
        },
      },
    ],
  })

  assert(
    momQuestions[0] === 'What changed in dining from $700 before to $842 this period?',
    `expected MoM question first, got: ${momQuestions[0]}`
  )
  assert(!momQuestions.some((question) => question.includes('×')), 'quick questions should avoid multipliers')
  assert(momQuestions.length === 3, 'quick questions should cap at 3')
  console.log('  pass: MoM-aware quick questions')

  assert(toneForChange('income', 'up') === 'positive', 'tone helper mismatch')
  assert(toneForChange('spending', 'up') === 'negative', 'tone helper mismatch')
  console.log('  pass: badge tone helper')

  const preview = selectHistoryPreviewStats([
    { label: 'Liquid Cash', value: '$9,100', delta: null },
    {
      label: 'Dining',
      value: '$842',
      delta: { direction: 'up', percent: 18, times: 1.18, absoluteChange: 142 },
    },
    {
      label: 'Income',
      value: '$5,200',
      delta: { direction: 'down', percent: 8, times: 0.92, absoluteChange: 450 },
    },
  ])

  assert(preview[0].label === 'Dining', 'stats with deltas should preview first')
  assert(preview.length === 2, 'history preview should cap at two stats')
  assert(
    formatCompactDelta({
      direction: 'up',
      percent: 18,
      times: 1.18,
      absoluteChange: 142,
    }) === '↑ +$142',
    'compact delta format'
  )
  assert(
    formatCompactDelta({ direction: 'up', percent: 18 }) === '↑ 18%',
    'legacy percent-only delta should retain percent context'
  )
  assert(compactDeltaToneClass('income', { direction: 'down', percent: 8 }) === 'text-danger', 'income down tone')
  console.log('  pass: history timeline stat preview helpers')

  const totalPassed = 6
  console.log(`\n${totalPassed}/${totalPassed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
