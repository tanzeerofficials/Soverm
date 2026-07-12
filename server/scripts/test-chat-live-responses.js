/*
 * LIVE ASK SOVERM ANSWER-QUALITY TESTS
 *
 * Offline: always scores sample good/bad replies with chatAnswerQuality helpers.
 * Live: when RUN_LIVE_CHAT_TESTS=1 and ANTHROPIC_API_KEY is set, calls Claude
 * with a fixed fixture and asserts the model:
 *   - cites real dollars from the fixture
 *   - names a next step
 *   - does not invent merchants that were never in the data
 *
 * Usage:
 *   node scripts/test-chat-live-responses.js
 *   RUN_LIVE_CHAT_TESTS=1 node scripts/test-chat-live-responses.js
 */

import 'dotenv/config'
import { buildExpenseAnalyzerChatContextFromPayload } from '../utils/expenseAnalyzerChatContext.js'
import {
  DEFAULT_BANNED_MERCHANTS,
  replyCitesAmount,
  replyCitesMerchant,
  replyHasNextStep,
  scoreChatAnswer,
} from '../utils/chatAnswerQuality.js'
import { askFinancialQuestion } from '../services/claude.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

/*
 * What this does: builds a deterministic live financial snapshot for chat tests.
 * Why: live answer quality must use known merchants/dollars so we can assert
 * the model cites them and does not invent others (e.g. Netflix).
 */
export function buildAnswerQualityFixture() {
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
        merchant: 'Planet Fitness',
        category: 'Recreation',
        averageAmount: 25.35,
        monthlyEquivalent: 25.35,
        cadence: 'monthly',
        source: 'heuristic',
        confidence: 'medium',
        detectionReason: {
          summary: 'Likely gym membership',
          detail: '2 similar monthly charges',
        },
      },
    ],
    categoryBreakdown: [
      {
        category: 'Food and Drink',
        currentTotal: 210,
        priorTotal: 150,
        delta: { direction: 'up', percent: 40 },
        recurringMonthly: 0,
        oneTimeTotal: 210,
        percentOfTotal: 28,
        accountBreakdown: [],
        topMerchants: [{ merchant: 'Chipotle', total: 48.2 }],
      },
      {
        category: 'General Merchandise',
        currentTotal: 120,
        priorTotal: 90,
        delta: { direction: 'up', percent: 33 },
        recurringMonthly: 89.4,
        oneTimeTotal: 30.6,
        percentOfTotal: 16,
        accountBreakdown: [],
        topMerchants: [{ merchant: 'SparkFun', total: 89.4 }],
      },
    ],
    topMover: { category: 'Food and Drink', direction: 'up', percent: 40 },
    overallSpending: {
      currentTotal: 740,
      priorTotal: 680,
      delta: { direction: 'up', percent: 9 },
      recurringMonthly: 89.4,
      oneTimeTotal: 650.6,
    },
    billDefense: [
      {
        type: 'price_increase',
        tone: 'warning',
        merchant: 'SparkFun',
        title: 'SparkFun got more expensive',
        detail: 'Up $10 (12%) from prior charge.',
        monthlyEquivalent: 89.4,
        percentIncrease: 12,
        amountDelta: 10,
      },
    ],
  })

  return {
    capturedAt: '2026-07-10T12:00:00.000Z',
    accounts: {
      netTotalBalance: 266,
      balanceNote:
        'Net total subtracts credit card, loan, and mortgage balances owed from cash/checking available balances',
      items: [
        {
          bankName: 'Chase',
          name: 'Checking',
          type: 'depository',
          balance: 66,
          isCredit: false,
          balanceMeaning: 'available cash (checking/savings) or investment value',
        },
        {
          bankName: 'Chase',
          name: 'Savings',
          type: 'depository',
          balance: 200,
          isCredit: false,
          balanceMeaning: 'available cash (checking/savings) or investment value',
        },
      ],
    },
    liveMonthOverMonth: {
      hasData: true,
      scope: 'connected accounts only',
      spending: {
        currentTotal: 740,
        priorTotal: 680,
        delta: { direction: 'up', percent: 9 },
      },
    },
    recentActivity: {
      scope: 'connected accounts only',
      totalSpending: 210,
      topMerchants: [
        { merchant: 'Chipotle', total: 48.2, transactionCount: 3 },
        { merchant: 'SparkFun', total: 89.4, transactionCount: 1 },
      ],
    },
    expenseAnalyzer,
    dataScope: {
      disconnectedAccountPolicy:
        'When a bank account is disconnected, its transactions are excluded from category breakdown, recurring detection, and live spending totals.',
      disconnectedOrphanedTransactionCountLast90Days: 0,
    },
    weeklyReview: {
      weekLabel: 'Jul 6–12',
      sparse: false,
      whatsLeft: {
        configured: true,
        amount: 180.25,
        daysUntilPayday: 4,
        nextPaydayOn: '2026-07-14',
        billsUntilPaydayTotal: 40,
        bills: [
          {
            date: '2026-07-12',
            merchant: 'SparkFun',
            amount: 89.4,
            cadence: 'monthly',
          },
        ],
      },
      runwayCoach: {
        verdict: 'tight',
        title: 'Tight runway',
        detail: 'Pace is high relative to days left.',
      },
      risk: {
        title: 'Dining is climbing',
        detail: 'Food and Drink up vs last week',
        tone: 'warning',
      },
      move: {
        title: 'Cook twice',
        detail: 'Skip two takeout nights before payday',
        id: 'cook',
      },
      billDefense: [
        {
          type: 'price_increase',
          merchant: 'SparkFun',
          title: 'SparkFun got more expensive',
          detail: 'Up $10 (12%).',
          monthlyEquivalent: 89.4,
          percentIncrease: 12,
        },
      ],
    },
    monthCondition: {
      monthKey: '2026-07',
      monthLabel: 'July',
      condition: {
        grade: 'tight',
        title: 'Tight',
        summary: 'Buffer is thin this month.',
      },
    },
    openActions: [
      { description: 'Cook twice this week', status: 'accepted', source: 'weekly' },
    ],
    userMemory: {
      payday: {
        configured: true,
        payCadence: 'biweekly',
        nextPaydayOn: '2026-07-14',
        daysUntilPayday: 4,
      },
      whatsLeftUntilPayday: {
        configured: true,
        amount: 180.25,
        daysUntilPayday: 4,
      },
      spendingCap: { configured: false },
      softLimits: [
        {
          category: 'Food and Drink',
          monthlyLimit: 300,
          spentThisMonth: 210,
          remaining: 90,
          percentUsed: 70,
          isOver: false,
          isWarning: false,
        },
      ],
      problemCategories: [{ category: 'Food and Drink', percentUp: 40 }],
      openActions: [{ description: 'Cook twice this week', status: 'accepted' }],
      goals: [],
      coachingNote: 'Refer back to payday and open actions when relevant.',
    },
  }
}

const LIVE_CASES = [
  {
    id: 'subscriptions-worth-canceling',
    question:
      'Walk me through my subscriptions — which ones are worth keeping vs canceling? Be specific with dollars and give me one next step.',
    requiredAmounts: [89.4, 1072.8],
    requiredMerchants: ['SparkFun'],
    bannedMerchants: DEFAULT_BANNED_MERCHANTS,
    requireNextStep: true,
  },
  {
    id: 'afford-dinner',
    question:
      'Can I afford a $40 dinner before payday? Tell me yes/no/caution with dollars left and one next step.',
    requiredAmounts: [40, 180.25],
    requiredMerchants: [],
    bannedMerchants: DEFAULT_BANNED_MERCHANTS,
    requireNextStep: true,
  },
  {
    id: 'maximize-savings',
    question:
      'How can I maximize my savings with what I am spending now? Cite my real subscriptions and give one next step I can do today.',
    requiredAmounts: [89.4],
    requiredMerchants: ['SparkFun'],
    bannedMerchants: DEFAULT_BANNED_MERCHANTS,
    requireNextStep: true,
  },
]

function runOfflineScorerTests() {
  console.log('Offline answer-quality scorer tests\n')

  const good = scoreChatAnswer(
    'SparkFun is $89.40/mo ($1,072.80/yr). Canceling it is the biggest cut. Next step: cancel SparkFun today.',
    {
      requiredAmounts: [89.4, 1072.8],
      requiredMerchants: ['SparkFun'],
      bannedMerchants: DEFAULT_BANNED_MERCHANTS,
      requireNextStep: true,
    }
  )
  assert(good.ok, `expected good reply to pass: ${good.failures.join('; ')}`)
  console.log('  pass: grounded reply scores ok')

  const missingMoney = scoreChatAnswer(
    'You should cancel some subscriptions. Next step: review them today.',
    {
      requiredAmounts: [89.4],
      requiredMerchants: ['SparkFun'],
      bannedMerchants: DEFAULT_BANNED_MERCHANTS,
    }
  )
  assert(!missingMoney.ok, 'expected missing dollars/merchants to fail')
  assert(missingMoney.missingAmounts.includes(89.4), 'tracks missing amount')
  assert(missingMoney.missingMerchants.includes('SparkFun'), 'tracks missing merchant')
  console.log('  pass: missing cites fail')

  const invented = scoreChatAnswer(
    'Cancel Netflix ($15.99) and SparkFun ($89.40). Next step: cancel Netflix.',
    {
      requiredAmounts: [89.4],
      requiredMerchants: ['SparkFun'],
      bannedMerchants: DEFAULT_BANNED_MERCHANTS,
    }
  )
  assert(!invented.ok, 'expected invented Netflix to fail')
  assert(invented.inventedMerchants.includes('Netflix'), 'flags Netflix as invented')
  console.log('  pass: invented merchant fails')

  const noStep = scoreChatAnswer(
    'SparkFun costs $89.40/mo ($1072.80/yr) and Chipotle showed up recently.',
    {
      requiredAmounts: [89.4],
      requiredMerchants: ['SparkFun'],
      bannedMerchants: DEFAULT_BANNED_MERCHANTS,
      requireNextStep: true,
    }
  )
  assert(!noStep.ok, 'expected missing next step to fail')
  assert(!noStep.hasNextStep, 'detects missing next step')
  console.log('  pass: missing next step fails')

  assert(replyCitesAmount('About $1,072.80 a year', 1072.8), 'comma money cite')
  assert(replyCitesMerchant('Cancel SparkFun now', 'SparkFun'), 'merchant cite')
  assert(replyHasNextStep('Next step: cook twice'), 'next step cite')
  console.log('  pass: helper edge cases')
  return 5
}

async function runLiveCase(fixture, testCase) {
  const reply = await askFinancialQuestion(null, [], testCase.question, {
    chatFinancialContext: fixture,
    insightActions: [],
  })

  const score = scoreChatAnswer(reply, {
    requiredAmounts: testCase.requiredAmounts,
    requiredMerchants: testCase.requiredMerchants,
    bannedMerchants: testCase.bannedMerchants,
    requireNextStep: testCase.requireNextStep,
  })

  if (!score.ok) {
    console.error('\n--- failing reply ---')
    console.error(reply)
    console.error('--- failures ---')
    console.error(score.failures.join('\n'))
    throw new Error(`live case "${testCase.id}" failed: ${score.failures.join('; ')}`)
  }

  console.log(`  pass: live ${testCase.id}`)
  return { id: testCase.id, reply, score }
}

async function main() {
  let passed = runOfflineScorerTests()

  const runLive = process.env.RUN_LIVE_CHAT_TESTS === '1'
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY)

  if (!runLive) {
    console.log(
      '\nSkipping live Claude calls (set RUN_LIVE_CHAT_TESTS=1 with ANTHROPIC_API_KEY to enable).'
    )
    console.log(`\n${passed} offline checks passed.`)
    return
  }

  if (!hasKey) {
    throw new Error(
      'RUN_LIVE_CHAT_TESTS=1 requires ANTHROPIC_API_KEY in the environment'
    )
  }

  console.log('\nLive Claude answer-quality tests\n')
  const fixture = buildAnswerQualityFixture()

  for (const testCase of LIVE_CASES) {
    await runLiveCase(fixture, testCase)
    passed++
  }

  console.log(`\n${passed} answer-quality checks passed (including live).`)
}

main().catch((err) => {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
})
