/*
 * Verifies unified chat financial context loading and prompt wiring.
 *
 * Usage: node scripts/test-chat-financial-context.js
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildExpenseAnalyzerChatContextFromPayload } from '../utils/expenseAnalyzerChatContext.js'
import {
  buildInsightChatSystemPrompt,
  buildLiveFinancialChatPromptBlock,
  CHAT_HISTORY_MESSAGE_LIMIT,
  CHAT_MAX_OUTPUT_TOKENS,
} from '../services/claude.js'
import { test } from 'node:test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chatRouteSource = readFileSync(join(__dirname, '../routes/chat.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

test('chat financial context', () => {
  console.log('Chat financial context tests\n')

  assert(
    chatRouteSource.includes('loadChatFinancialContext'),
    'chat.js must load unified chat financial context'
  )
  assert(
    chatRouteSource.includes("router.get('/limits'"),
    'chat.js must expose GET /limits for tier-aware message caps'
  )
  assert(
    chatRouteSource.includes('getChatRateLimitStatus'),
    'chat.js must report chatLimit after sends'
  )
  assert(
    chatRouteSource.includes('chatFinancialContext'),
    'chat.js must pass chatFinancialContext to askFinancialQuestion'
  )
  assert(
    chatRouteSource.includes('CHAT_HISTORY_MESSAGE_LIMIT') &&
      chatRouteSource.includes('LIMIT ${CHAT_HISTORY_MESSAGE_LIMIT}'),
    'chat history should use CHAT_HISTORY_MESSAGE_LIMIT'
  )
  assert(CHAT_MAX_OUTPUT_TOKENS >= 1024, 'chat max output tokens should allow longer answers')
  assert(CHAT_HISTORY_MESSAGE_LIMIT >= 20, 'chat history limit should be generous')
  console.log('  pass: chat route and model limits')
  passed++

  const sparkFunExpense = buildExpenseAnalyzerChatContextFromPayload({
    totalRecurringMonthly: 89.4,
    recurringCharges: [
      {
        merchant: 'SparkFun',
        category: 'General Merchandise',
        monthlyEquivalent: 89.4,
        cadence: 'monthly',
        source: 'both',
        confidence: 'high',
      },
    ],
    reviewCharges: [],
    categoryBreakdown: [],
    overallSpending: { currentTotal: 800, priorTotal: 750 },
  })

  const chatContext = {
    capturedAt: '2026-07-06T12:00:00.000Z',
    accounts: {
      netTotalBalance: 4200,
      balanceNote: 'Net total subtracts credit card, loan, and mortgage balances owed from cash/checking available balances',
      items: [{ name: 'Chase Checking', type: 'depository', balance: 4200, isCredit: false }],
    },
    liveMonthOverMonth: {
      hasData: true,
      spending: { currentTotal: 800, priorTotal: 750, delta: { direction: 'up', percent: 7 } },
    },
    recentActivity: {
      totalSpending: 800,
      topMerchants: [{ merchant: 'SparkFun', total: 89.4, transactionCount: 1 }],
      recentTransactions: [{ date: '2026-07-01', merchant: 'SparkFun', amount: 89.4 }],
    },
    expenseAnalyzer: sparkFunExpense,
  }

  const liveBlock = buildLiveFinancialChatPromptBlock(chatContext)
  assert(liveBlock.block.includes('Live financial snapshot'), 'live block must be labeled')
  assert(liveBlock.block.includes('SparkFun'), 'live block must include SparkFun')
  assert(liveBlock.block.includes('1072.8'), 'live block must include annual recurring')
  assert(liveBlock.block.includes('Chase Checking'), 'live block must include account balances')
  assert(
    liveBlock.instruction.includes('Never say data is unavailable'),
    'live block must forbid claiming missing data'
  )
  console.log('  pass: live financial prompt block')
  passed++

  const prompt = buildInsightChatSystemPrompt({
    insightBody: { headline: 'Test', stats: [], fullSummary: ['Summary'], actions: [] },
    monthOverMonthComparison: {
      hasComparisonData: true,
      currentPeriod: { spending: { total: 800 }, income: { total: 5000 } },
      priorPeriod: { spending: { total: 750 }, income: { total: 4800 } },
    },
    generatedAt: '2026-06-01T12:00:00.000Z',
    chatFinancialContext: chatContext,
  })

  assert(prompt.includes('Live financial snapshot'), 'system prompt must include live data section')
  assert(
    prompt.includes('personal money person') || prompt.includes('genuinely cares'),
    'system prompt should set human advisor tone'
  )
  assert(
    prompt.includes('Warmth doesn\'t mean vagueness') ||
      prompt.includes("Warmth doesn't mean vagueness"),
    'system prompt should keep accuracy alongside warmth'
  )
  assert(prompt.includes('ENGAGEMENT HOOK'), 'system prompt should include engagement hook rules')
  assert(
    prompt.includes('LOOKUP TOOLS') && prompt.includes('get_category_transactions'),
    'system prompt should document category/merchant lookup tools'
  )
  assert(
    prompt.includes('Never repeat the same closing question') ||
      prompt.includes('Never use the same closing question twice'),
    'engagement hook must ban repeated closing questions'
  )
  assert(
    prompt.includes('yes/no afford') ||
      prompt.includes("what's my balance") ||
      prompt.includes('whats my balance'),
    'engagement hook must allow skipping on simple factual questions'
  )
  assert(
    !prompt.includes('You do not have access to live bank data'),
    'system prompt must not deny live data access'
  )

  const generalPrompt = buildInsightChatSystemPrompt({
    insightBody: null,
    monthOverMonthComparison: null,
    generatedAt: null,
    chatFinancialContext: chatContext,
  })
  assert(
    generalPrompt.includes('ENGAGEMENT HOOK'),
    'general chat prompt should also include engagement hook rules'
  )
  console.log('  pass: upgraded chat system prompt')
  passed++

  console.log(`\n${passed}/${passed} chat financial context tests passed.`)
})
