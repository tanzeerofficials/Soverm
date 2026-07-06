/*
 * Audit test — verifies chat context covers all user-facing financial features.
 *
 * Usage: node scripts/test-chat-context-audit.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildExpenseAnalyzerChatContextFromPayload } from '../utils/expenseAnalyzerChatContext.js'
import { buildInsightChatSystemPrompt, buildLiveFinancialChatPromptBlock } from '../services/claude.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chatRouteSource = readFileSync(join(__dirname, '../routes/chat.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function buildFullChatContext() {
  const expenseAnalyzer = buildExpenseAnalyzerChatContextFromPayload({
    totalRecurringMonthly: 89.4,
    totalReviewMonthly: 25,
    recurringCharges: [
      {
        merchant: 'SparkFun',
        category: 'General Merchandise',
        averageAmount: 89.4,
        monthlyEquivalent: 89.4,
        cadence: 'monthly',
        source: 'both',
        confidence: 'high',
        accountLabel: 'Plaid Checking',
        occurrenceCount: 3,
        lastChargedDate: '2026-07-01',
        nextExpectedDate: '2026-08-01',
        detectionReason: {
          summary: '3 identical monthly charges',
          detail: 'Same amount every ~30 days',
        },
      },
    ],
    reviewCharges: [
      {
        merchant: 'Uber',
        category: 'Transportation',
        averageAmount: 18,
        monthlyEquivalent: 72,
        cadence: 'weekly',
        source: 'heuristic',
        confidence: 'low',
        detectionReason: {
          summary: 'Repeat rides — may be commute, not a subscription',
          detail: 'Only 2 charges so far',
        },
      },
    ],
    categoryBreakdown: [
      {
        category: 'General Merchandise',
        currentTotal: 120,
        priorTotal: 90,
        delta: { direction: 'up', percent: 33 },
        recurringMonthly: 89.4,
        oneTimeTotal: 30.6,
        percentOfTotal: 15,
        accountBreakdown: [{ accountLabel: 'Plaid Checking', total: 120 }],
        topMerchants: [{ merchant: 'SparkFun', total: 89.4 }],
      },
      {
        category: 'Food and Drink',
        currentTotal: 200,
        priorTotal: 150,
        delta: { direction: 'up', percent: 33 },
        recurringMonthly: 0,
        oneTimeTotal: 200,
        percentOfTotal: 25,
        accountBreakdown: [],
        topMerchants: [{ merchant: 'Chipotle', total: 45 }],
      },
    ],
    topMover: { category: 'General Merchandise', direction: 'up', percent: 33 },
    overallSpending: {
      currentTotal: 800,
      priorTotal: 750,
      delta: { direction: 'up', percent: 7 },
      recurringMonthly: 89.4,
      oneTimeTotal: 710.6,
    },
  })

  return {
    capturedAt: '2026-07-06T12:00:00.000Z',
    accounts: {
      netTotalBalance: 5020,
      balanceNote: 'Net total subtracts credit card balances owed from cash/checking available balances',
      items: [
        {
          bankName: 'Chase',
          name: 'Plaid Checking',
          type: 'depository',
          balance: 5200,
          isCredit: false,
          balanceMeaning: 'available cash (checking/savings)',
        },
        {
          bankName: 'Chase',
          name: 'Plaid Credit Card',
          type: 'credit',
          balance: 180,
          isCredit: true,
          balanceMeaning: 'credit card balance owed (higher = more debt)',
        },
      ],
    },
    liveMonthOverMonth: {
      hasData: true,
      scope: 'connected accounts only',
      spending: {
        currentTotal: 800,
        priorTotal: 750,
        delta: { direction: 'up', percent: 7 },
      },
      categoryChanges: expenseAnalyzer.categoryBreakdown.map(({ category, delta }) => ({
        category,
        delta,
      })),
    },
    recentActivity: {
      scope: 'connected accounts only',
      totalSpending: 800,
      topMerchants: [{ merchant: 'SparkFun', total: 89.4 }],
    },
    expenseAnalyzer,
    dataScope: {
      disconnectedAccountPolicy:
        'When a bank account is disconnected, its transactions are excluded from category breakdown, recurring detection, and live spending totals.',
      disconnectedOrphanedTransactionCountLast90Days: 14,
      recurringConfidenceTiers: {
        confirmedRecurring: 'High confidence only',
        reviewRecurring: 'Medium/low confidence',
      },
    },
  }
}

const AUDIT_QUESTIONS = [
  {
    id: 'category-mover',
    question: 'Which category went up the most this month?',
    mustInclude: ['General Merchandise', '33'],
    dataPath: 'expenseAnalyzer.topMover',
  },
  {
    id: 'recurring-cancel',
    question: 'Do I have any subscriptions I should cancel?',
    mustInclude: ['SparkFun', '89.4', '1072.8', 'Confirmed'],
    dataPath: 'expenseAnalyzer.confirmedRecurring',
  },
  {
    id: 'disconnected-uber',
    question: "Why don't you count my old Uber rides as recurring anymore?",
    mustInclude: ['disconnected', 'Review', 'Uber'],
    dataPath: 'dataScope.disconnectedAccountPolicy',
  },
  {
    id: 'balance',
    question: 'What is my checking balance?',
    mustInclude: ['5200', 'Plaid Checking'],
    dataPath: 'accounts.items',
  },
  {
    id: 'credit-vs-cash',
    question: 'How much cash do I have vs credit card debt?',
    mustInclude: ['5020', 'credit card balance owed'],
    dataPath: 'accounts.netTotalBalance',
  },
  {
    id: 'confidence',
    question: 'How confident are you about my SparkFun subscription?',
    mustInclude: ['Confirmed', 'Plaid + pattern detection'],
    dataPath: 'expenseAnalyzer.confirmedRecurring[0].confidenceLabel',
  },
  {
    id: 'review-tier',
    question: 'What subscriptions are still under review?',
    mustInclude: ['Uber', 'Uncertain', 'Review'],
    dataPath: 'expenseAnalyzer.reviewRecurring',
  },
  {
    id: 'actions',
    question: 'What action items did you suggest and did I complete them?',
    mustInclude: ['Cut dining spend', 'completed'],
    dataPath: 'insightActions',
  },
]

let passed = 0

try {
  console.log('Chat context audit tests\n')

  assert(
    chatRouteSource.includes('loadInsightActionsForChat'),
    'chat route must load insight action completion status'
  )
  console.log('  pass: chat route loads action completion')
  passed++

  const chatContext = buildFullChatContext()
  const insightActions = [
    { description: 'Cut dining spend by 20%', completed: true },
    { description: 'Review SparkFun subscription', completed: false },
  ]

  const liveBlock = buildLiveFinancialChatPromptBlock(chatContext, { insightActions })
  const prompt = buildInsightChatSystemPrompt({
    insightBody: {
      headline: 'Spending is up',
      stats: [{ label: 'Dining', value: '$200', statType: 'spending' }],
      fullSummary: ['Dining increased this period.'],
      actions: ['Cut dining spend by 20%', 'Review SparkFun subscription'],
    },
    monthOverMonthComparison: {
      hasComparisonData: true,
      currentPeriod: { spending: { total: 800 }, income: { total: 5000 } },
      priorPeriod: { spending: { total: 750 }, income: { total: 4800 } },
    },
    generatedAt: '2026-06-01T12:00:00.000Z',
    chatFinancialContext: chatContext,
    insightActions,
  })

  assert(
    chatContext.expenseAnalyzer.totals.reviewCount === 1,
    'chat context must include review recurring count'
  )
  assert(
    chatContext.expenseAnalyzer.confirmedRecurring[0].confidenceLabel === 'Confirmed',
    'chat context must map confidence to UI label'
  )
  assert(
    chatContext.expenseAnalyzer.categoryBreakdown[0].accountBreakdown.length > 0,
    'chat context must include per-category account breakdown'
  )
  assert(
    chatContext.dataScope.disconnectedOrphanedTransactionCountLast90Days === 14,
    'chat context must include disconnected transaction count'
  )
  assert(chatContext.accounts.netTotalBalance === 5020, 'chat context must include net total balance')
  console.log('  pass: enriched chat context structure')
  passed++

  assert(liveBlock.block.includes('dataScope'), 'prompt must include data scope policy')
  assert(liveBlock.block.includes('insightActions'), 'prompt must include action completion')
  assert(liveBlock.block.includes('confidenceLabel'), 'prompt must include confidence labels')
  assert(liveBlock.block.includes('disconnectedAccountPolicy'), 'prompt must explain disconnected accounts')
  console.log('  pass: live prompt block coverage')
  passed++

  for (const audit of AUDIT_QUESTIONS) {
    for (const fragment of audit.mustInclude) {
      assert(
        prompt.includes(fragment) || liveBlock.block.includes(fragment),
        `[${audit.id}] prompt must contain "${fragment}" for: ${audit.question}`
      )
    }
    console.log(`  pass: audit question — ${audit.id}`)
    passed++
  }

  assert(
    liveBlock.instruction.includes('categoryBreakdown has per-category MoM deltas'),
    'prompt must instruct per-category MoM usage'
  )
  assert(
    liveBlock.instruction.includes('disconnectedAccountPolicy'),
    'prompt must instruct disconnected-account explanations'
  )
  console.log('  pass: prompt instructions for audit scenarios')
  passed++

  console.log(`\n${passed}/${passed} chat context audit tests passed.`)
} catch (err) {
  console.error(`\nFAILED: ${err.message}`)
  process.exit(1)
}
