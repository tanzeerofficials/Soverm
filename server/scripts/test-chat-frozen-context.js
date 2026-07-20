/*
 * Verifies insight-scoped chat uses frozen snapshot data, not live fetches.
 *
 * Usage: node scripts/test-chat-frozen-context.js
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  buildInsightChatSystemPrompt,
  buildPersistedInsightContent,
  resolveInsightGeneratedAt,
} from '../services/claude.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chatRouteSource = readFileSync(join(__dirname, '../routes/chat.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Chat frozen-context tests\n')

  assert(
    !chatRouteSource.includes('loadFinancialContextForUser'),
    'chat.js must not load live financial context'
  )
  assert(
    chatRouteSource.includes('created_at'),
    'chat.js must load insight created_at for generatedAt'
  )
  assert(
    chatRouteSource.includes('resolveInsightGeneratedAt'),
    'chat.js must resolve generatedAt from persisted metadata'
  )
  assert(
    chatRouteSource.includes('loadChatFinancialContext'),
    'chat.js must load live Expense Analyzer context for recurring questions'
  )
  console.log('  pass: chat route uses stored insight for MoM and live Expense Analyzer data')

  const persisted = buildPersistedInsightContent(
    {
      headline: 'Spending is up',
      headlineType: 'warning',
      stats: [
        {
          label: 'Dining',
          value: '$842',
          detail: 'Top category',
          statType: 'spending',
          delta: { direction: 'up', percent: 18, vsLabel: 'vs prior 30 days' },
        },
      ],
      fullSummary: ['Paragraph one'],
      actions: ['Cut dining'],
    },
    {
      hasComparisonData: true,
      currentPeriod: {
        spending: { total: 3287, byCategory: { Dining: 842 } },
        income: { total: 5200 },
      },
      priorPeriod: {
        spending: { total: 2797, byCategory: { Dining: 712 } },
        income: { total: 4800 },
      },
    },
    { transactionCount: 47, generatedAt: '2026-06-15T12:00:00.000Z' }
  )

  const generatedAt = persisted.metadata.generatedAt
  const prompt = buildInsightChatSystemPrompt({
    insightBody: {
      headline: persisted.headline,
      stats: persisted.stats,
      fullSummary: persisted.fullSummary,
      actions: persisted.actions,
    },
    monthOverMonthComparison: persisted.monthOverMonthComparison,
    generatedAt,
  })

  assert(prompt.includes('June 15, 2026'), 'prompt must include formatted generatedAt')
  assert(
    !prompt.includes('Their current financial data'),
    'prompt must not reference live transaction data'
  )
  assert(
    prompt.includes('Overall spending: $3,287 this period (was $2,797 before, +$490)'),
    'prompt must include frozen MoM figures'
  )
  assert(
    prompt.includes('Insight snapshot reflects finances as of'),
    'prompt must clarify insight snapshot timing'
  )
  assert(
    !prompt.includes('"monthOverMonthComparison"'),
    'MoM block should be separate from insight JSON body'
  )
  assert(
    !prompt.includes('"metadata"'),
    'metadata should be stripped from insight JSON body'
  )
  assert(
    resolveInsightGeneratedAt(JSON.stringify(persisted), '2020-01-01T00:00:00.000Z') ===
      generatedAt,
    'resolveInsightGeneratedAt must prefer metadata.generatedAt'
  )
  assert(
    resolveInsightGeneratedAt('{"headline":"legacy"}', '2020-01-01T00:00:00.000Z') ===
      '2020-01-01T00:00:00.000Z',
    'resolveInsightGeneratedAt must fall back to created_at for legacy insights'
  )
  console.log('  pass: chat system prompt uses frozen insight snapshot')

  const legacyPrompt = buildInsightChatSystemPrompt({
    insightBody: {
      headline: 'Older insight',
      stats: [],
      fullSummary: ['Legacy text'],
      actions: [],
    },
    monthOverMonthComparison: null,
    generatedAt: '2025-01-01T00:00:00.000Z',
  })

  assert(
    legacyPrompt.includes('No month-over-month comparison is available'),
    'legacy insights without MoM snapshot must degrade gracefully'
  )
  console.log('  pass: legacy insights without MoM snapshot handled')

  passed = 3
  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
