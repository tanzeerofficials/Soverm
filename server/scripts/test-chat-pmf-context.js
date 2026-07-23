/**
 * Unit checks for chat PMF slim helpers (T2.4 / T2.6) — no DB required.
 *
 * Usage: node scripts/test-chat-pmf-context.js
 */

import {
  buildUserMemoryForChat,
  slimMonthConditionForChat,
  slimWeeklyReviewForChat,
} from '../utils/chatPmfContext.js'
import {
  buildInsightChatSystemPrompt,
  buildLiveFinancialChatPromptBlock,
} from '../services/claude.js'
import { test } from 'node:test'

test('chat pmf context', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('chatPmfContext tests\n')

  const weekly = slimWeeklyReviewForChat({
    week: { label: 'Jul 6–12', weekStartIso: '2026-07-06' },
    sparse: false,
    howYouDid: { spentThisWeek: 412.5, summary: 'Spent a bit under last week.' },
    whatsLeft: {
      configured: true,
      amount: 180.25,
      daysUntilPayday: 4,
      nextPaydayOn: '2026-07-10',
      billsUntilPaydayTotal: 40,
      bills: [{ date: '2026-07-08', merchant: 'Netflix', amount: 15.99, cadence: 'monthly' }],
    },
    runwayCoach: { verdict: 'tight', title: 'Tight', detail: 'Pace is high.' },
    risk: { title: 'Dining', detail: 'Up vs last week', tone: 'warning' },
    move: { title: 'Cook twice', detail: 'Skip two takeout nights', id: 'cook' },
    billDefense: [
      {
        type: 'price_increase',
        tone: 'warning',
        merchant: 'Netflix',
        title: 'Netflix got more expensive',
        detail: 'Up $3 (20%).',
        monthlyEquivalent: 15.99,
        percentIncrease: 20,
        amountDelta: 3,
      },
    ],
    followUps: [{ summary: 'You accepted a dining cut', status: 'accepted', stillRelevant: true }],
  })

  assert(weekly.whatsLeft.amount === 180.25, 'whats left amount')
  assert(weekly.move.title === 'Cook twice', 'move title')
  assert(weekly.whatsLeft.bills[0].merchant === 'Netflix', 'whats left bills kept')
  assert(weekly.billDefense[0].merchant === 'Netflix', 'bill defense kept')

  const month = slimMonthConditionForChat({
    monthKey: '2026-07',
    monthLabel: 'July',
    isCurrentMonth: true,
    headline: 'July so far — Tight',
    condition: { grade: 'tight', title: 'Tight', summary: 'Buffer is thin.' },
    cashFlow: {
      income: 3000,
      spent: 2800,
      net: 200,
      outcome: 'surplus',
      summary: 'Small surplus.',
    },
    drivers: [{ category: 'Food', amount: 400 }],
    nextMonthPlan: [{ title: 'Trim dining', detail: 'Cap at $300' }],
  })

  assert(month.condition.grade === 'tight', 'month grade')
  assert(month.topDrivers[0].category === 'Food', 'drivers')

  const memory = buildUserMemoryForChat({
    payday: { configured: true, payCadence: 'biweekly', nextPaydayOn: '2026-07-10' },
    whatsLeft: { configured: true, amount: 180 },
    problemCategories: [{ category: 'Food', percentUp: 33 }],
    categorySoftLimits: [
      {
        category: 'Food',
        monthlyLimit: 300,
        spentThisMonth: 280,
        remaining: 20,
        percentUsed: 93,
        isWarning: true,
        isOver: false,
      },
    ],
    spendingCap: {
      configured: true,
      monthlyBudget: 2500,
      spentThisMonth: 1800,
      remaining: 700,
      safeToSpend: 500,
      percentUsed: 72,
      isOverBudget: false,
    },
    openActions: [{ description: 'Cook twice', status: 'accepted' }],
    recentResolvedActions: [{ description: 'Cancel Hulu', status: 'done' }],
  })

  assert(memory.payday.configured === true, 'memory payday')
  assert(memory.openActions.length === 1, 'memory open actions')
  assert(memory.coachingNote.includes('as we talked about'), 'coaching note')
  assert(memory.softLimits[0].isWarning === true, 'soft limit warning flag')
  assert(memory.spendingCap.safeToSpend === 500, 'spending cap safe-to-spend')

  const liveBlock = buildLiveFinancialChatPromptBlock({
    capturedAt: '2026-07-10T12:00:00.000Z',
    accounts: { netTotalBalance: 500, balanceNote: '', items: [] },
    liveMonthOverMonth: { hasData: false },
    recentActivity: null,
    expenseAnalyzer: null,
    dataScope: null,
    weeklyReview: weekly,
    monthCondition: month,
    openActions: memory.openActions,
    userMemory: memory,
  })

  assert(liveBlock.block.includes('weeklyReview'), 'prompt includes weekly')
  assert(liveBlock.block.includes('monthCondition'), 'prompt includes month')
  assert(liveBlock.block.includes('userMemory'), 'prompt includes memory')
  assert(liveBlock.block.includes('billDefense'), 'prompt includes bill defense')
  assert(liveBlock.instruction.includes('DEFAULT FRAME'), 'prompt defaults to PMF frame')
  assert(liveBlock.instruction.includes('as we talked about'), 'prompt memory instruction')
  assert(liveBlock.instruction.includes('ANSWER SHAPE'), 'prompt requires actionable answer shape')
  assert(liveBlock.instruction.includes('can I afford'), 'prompt has affordability guidance')

  const generalPrompt = buildInsightChatSystemPrompt({
    insightBody: null,
    monthOverMonthComparison: null,
    generatedAt: null,
    chatFinancialContext: {
      capturedAt: '2026-07-10T12:00:00.000Z',
      accounts: { netTotalBalance: 500, balanceNote: '', items: [] },
      liveMonthOverMonth: { hasData: false },
      recentActivity: null,
      expenseAnalyzer: null,
      dataScope: null,
      weeklyReview: weekly,
      monthCondition: month,
      openActions: memory.openActions,
      userMemory: memory,
    },
  })

  assert(generalPrompt.includes('COMMON LIFE QUESTIONS'), 'general prompt has life-questions playbook')
  assert(generalPrompt.includes('file taxes online') || generalPrompt.includes('taxes online'), 'playbook covers filing taxes')
  assert(generalPrompt.includes('night out'), 'playbook covers night-out plans')
  assert(generalPrompt.includes('MAXIMIZE SAVINGS'), 'playbook covers savings')

  console.log('All chatPmfContext tests passed.')
})
