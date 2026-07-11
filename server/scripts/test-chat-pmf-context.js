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
import { buildLiveFinancialChatPromptBlock } from '../services/claude.js'

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
  },
  runwayCoach: { verdict: 'tight', title: 'Tight', detail: 'Pace is high.' },
  risk: { title: 'Dining', detail: 'Up vs last week', tone: 'warning' },
  move: { title: 'Cook twice', detail: 'Skip two takeout nights', id: 'cook' },
  followUps: [{ summary: 'You accepted a dining cut', status: 'accepted', stillRelevant: true }],
})

assert(weekly.whatsLeft.amount === 180.25, 'whats left amount')
assert(weekly.move.title === 'Cook twice', 'move title')

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
  openActions: [{ description: 'Cook twice', status: 'accepted' }],
  recentResolvedActions: [{ description: 'Cancel Hulu', status: 'done' }],
})

assert(memory.payday.configured === true, 'memory payday')
assert(memory.openActions.length === 1, 'memory open actions')
assert(memory.coachingNote.includes('as we talked about'), 'coaching note')

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
assert(liveBlock.instruction.includes('DEFAULT FRAME'), 'prompt defaults to PMF frame')
assert(liveBlock.instruction.includes('as we talked about'), 'prompt memory instruction')

console.log('All chatPmfContext tests passed.')
