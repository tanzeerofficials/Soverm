/*
 * Verifies insight-scoped chat includes live Expense Analyzer context.
 *
 * Usage: node scripts/test-chat-expense-analyzer-context.js
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  buildExpenseAnalyzerChatContextFromPayload,
  loadExpenseAnalyzerChatContext,
} from '../utils/expenseAnalyzerChatContext.js'
import {
  buildExpenseAnalyzerChatPromptBlock,
  buildInsightChatSystemPrompt,
  buildLiveFinancialChatPromptBlock,
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
  console.log('Chat expense analyzer context tests\n')

  assert(
    chatRouteSource.includes('loadChatFinancialContext'),
    'chat.js must load live Expense Analyzer context'
  )
  assert(
    chatRouteSource.includes('chatFinancialContext'),
    'chat.js must pass chatFinancialContext to askFinancialQuestion'
  )
  assert(
    !chatRouteSource.includes('loadFinancialContextForUser'),
    'chat.js must not load raw live transaction dump'
  )
  console.log('  pass: chat route wires Expense Analyzer context')
  passed++

  const sparkFunContext = buildExpenseAnalyzerChatContextFromPayload({
    totalRecurringMonthly: 89.4,
    totalReviewMonthly: 0,
    recurringCharges: [
      {
        merchant: 'SparkFun',
        category: 'General Merchandise',
        monthlyEquivalent: 89.4,
        cadence: 'monthly',
        source: 'both',
        confidence: 'high',
        accountLabel: 'Chase Checking',
      },
    ],
    reviewCharges: [],
    categoryBreakdown: [
      {
        category: 'General Merchandise',
        currentTotal: 120,
        priorTotal: 110,
        delta: { direction: 'up', percent: 9 },
        recurringMonthly: 89.4,
        oneTimeTotal: 30.6,
        percentOfTotal: 15,
      },
    ],
    overallSpending: {
      currentTotal: 800,
      priorTotal: 750,
      delta: { direction: 'up', percent: 7 },
    },
  })

  assert(
    sparkFunContext.totals.confirmedRecurringAnnual === 1072.8,
    'Annual total should be 89.40 × 12 = 1072.80'
  )
  assert(
    sparkFunContext.confirmedRecurring[0].sourceLabel === 'Plaid + pattern detection',
    'SparkFun source label should reflect Plaid + pattern detection'
  )
  console.log('  pass: SparkFun chat context annualization')
  passed++

  const expenseBlock = buildExpenseAnalyzerChatPromptBlock(sparkFunContext)
  const liveBlock = buildLiveFinancialChatPromptBlock({
    capturedAt: sparkFunContext.capturedAt,
    accounts: [],
    liveMonthOverMonth: { hasData: false },
    recentActivity: null,
    expenseAnalyzer: sparkFunContext,
  })

  assert(
    expenseBlock.block.includes('SparkFun'),
    'Legacy expense block must include SparkFun merchant'
  )
  assert(
    liveBlock.block.includes('1072.8'),
    'Live block must include annual total'
  )
  assert(
    expenseBlock.instruction.includes('Never say data is unavailable'),
    'Prompt must instruct Claude not to claim missing recurring data'
  )
  console.log('  pass: expense analyzer prompt block')
  passed++

  const prompt = buildInsightChatSystemPrompt({
    insightBody: {
      headline: 'Spending is steady',
      stats: [],
      fullSummary: ['Legacy insight paragraph'],
      actions: [],
    },
    monthOverMonthComparison: {
      hasComparisonData: true,
      capturedAt: '2026-06-01T12:00:00.000Z',
      currentPeriod: {
        spending: { total: 800, byCategory: {} },
        income: { total: 5000 },
      },
      priorPeriod: {
        spending: { total: 750, byCategory: {} },
        income: { total: 4800 },
      },
    },
    generatedAt: '2026-06-01T12:00:00.000Z',
    expenseAnalyzerContext: sparkFunContext,
  })

  assert(
    prompt.includes('Live financial snapshot'),
    'System prompt must include live financial section'
  )
  assert(
    prompt.includes('1072.8') && prompt.includes('SparkFun'),
    'System prompt must expose SparkFun annual recurring data'
  )
  assert(
    prompt.includes('Overall spending: up 7% vs prior 30 days ($800 vs $750)'),
    'Frozen MoM figures must still come from insight snapshot'
  )
  assert(
    !prompt.includes('You do not have access to live bank data'),
    'Prompt must not claim chat lacks live recurring data'
  )
  console.log('  pass: combined chat system prompt')
  passed++

  assert(typeof loadExpenseAnalyzerChatContext === 'function', 'loader must be exported')
  console.log('  pass: loader exported')
  passed++

  console.log(`\n${passed}/${passed} chat expense analyzer context tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
