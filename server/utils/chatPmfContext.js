/*
 * CHAT PMF CONTEXT
 *
 * Slim weekly / monthly / memory slices for Ask Soverm so chat defaults to
 * paycheck-to-paycheck coaching (T2.4 + T2.6), not generic finance Q&A.
 */

import { listRecentActions, buildWeeklyActionFollowUps } from '../services/actionsService.js'
import { buildWeeklyReviewForUser } from '../services/weeklyReview.js'
import { buildMonthConditionLetterForUser } from '../services/monthConditionLetter.js'
import { buildTrackerSnapshotWithFallback } from '../services/trackerSnapshot.js'

function roundCurrency(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) {
    return null
  }
  return Math.round(n * 100) / 100
}

/**
 * Pure: slim weekly review for the chat prompt (keeps tokens down).
 */
export function slimWeeklyReviewForChat(review) {
  if (!review) {
    return null
  }

  return {
    weekLabel: review.week?.label ?? null,
    weekStartIso: review.week?.weekStartIso ?? null,
    sparse: Boolean(review.sparse),
    howYouDid: review.howYouDid
      ? {
          spentThisWeek: roundCurrency(review.howYouDid.spentThisWeek),
          summary: review.howYouDid.summary ?? null,
        }
      : null,
    whatsLeft: review.whatsLeft
      ? {
          configured: Boolean(review.whatsLeft.configured),
          amount: roundCurrency(review.whatsLeft.amount),
          daysUntilPayday: review.whatsLeft.daysUntilPayday ?? null,
          nextPaydayOn: review.whatsLeft.nextPaydayOn ?? null,
          billsUntilPaydayTotal: roundCurrency(review.whatsLeft.billsUntilPaydayTotal),
        }
      : null,
    runwayCoach: review.runwayCoach
      ? {
          verdict: review.runwayCoach.verdict ?? null,
          title: review.runwayCoach.title ?? null,
          detail: review.runwayCoach.detail ?? null,
          pace: review.runwayCoach.pace ?? null,
        }
      : null,
    risk: review.risk
      ? { title: review.risk.title, detail: review.risk.detail, tone: review.risk.tone }
      : null,
    move: review.move
      ? { title: review.move.title, detail: review.move.detail, id: review.move.id }
      : null,
    followUps: (review.followUps ?? []).slice(0, 3).map((item) => ({
      summary: item.summary,
      status: item.status,
      stillRelevant: item.stillRelevant,
    })),
  }
}

/**
 * Pure: slim month condition letter for chat.
 */
export function slimMonthConditionForChat(letter) {
  if (!letter) {
    return null
  }

  return {
    monthKey: letter.monthKey ?? null,
    monthLabel: letter.monthLabel ?? null,
    isCurrentMonth: Boolean(letter.isCurrentMonth),
    headline: letter.headline ?? null,
    condition: letter.condition
      ? {
          grade: letter.condition.grade,
          title: letter.condition.title,
          summary: letter.condition.summary,
        }
      : null,
    cashFlow: letter.cashFlow
      ? {
          income: roundCurrency(letter.cashFlow.income),
          spent: roundCurrency(letter.cashFlow.spent),
          net: roundCurrency(letter.cashFlow.net),
          outcome: letter.cashFlow.outcome,
          summary: letter.cashFlow.summary,
        }
      : null,
    topDrivers: (letter.drivers ?? []).slice(0, 3).map((driver) => ({
      category: driver.category,
      amount: roundCurrency(driver.amount),
    })),
    nextMonthPlan: (letter.nextMonthPlan ?? []).slice(0, 3).map((move) => ({
      title: move.title,
      detail: move.detail,
    })),
  }
}

/**
 * Pure: compound memory from payday, problem categories, goals, actions.
 */
export function buildUserMemoryForChat({
  payday = null,
  whatsLeft = null,
  categorySoftLimits = [],
  savingTrackers = [],
  problemCategories = [],
  openActions = [],
  recentResolvedActions = [],
  followUps = [],
} = {}) {
  return {
    payday: payday
      ? {
          configured: Boolean(payday.configured),
          payCadence: payday.payCadence ?? null,
          nextPaydayOn: payday.nextPaydayOn ?? null,
          daysUntilPayday: payday.daysUntilPayday ?? null,
        }
      : { configured: false },
    whatsLeftUntilPayday: whatsLeft
      ? {
          configured: Boolean(whatsLeft.configured),
          amount: roundCurrency(whatsLeft.amount),
          daysUntilPayday: whatsLeft.daysUntilPayday ?? null,
        }
      : { configured: false },
    problemCategories: problemCategories.slice(0, 3),
    softLimits: (categorySoftLimits ?? []).slice(0, 5).map((limit) => ({
      category: limit.category,
      monthlyLimit: roundCurrency(limit.monthlyLimit ?? limit.monthly_limit),
      spentThisMonth: roundCurrency(limit.spentThisMonth ?? limit.spent_this_month),
      status: limit.status ?? null,
    })),
    goals: (savingTrackers ?? []).slice(0, 3).map((tracker) => ({
      name: tracker.name,
      purposeType: tracker.purposeType ?? tracker.purpose_type,
      monthlyAmount: roundCurrency(tracker.monthlyAmount ?? tracker.monthly_amount),
    })),
    openActions: openActions.slice(0, 5),
    recentResolvedActions: recentResolvedActions.slice(0, 5),
    priorWeekFollowUps: followUps.slice(0, 3),
    coachingNote:
      'When relevant, refer back to payday, open actions, soft limits, and prior follow-ups ("as we talked about…") instead of starting from scratch.',
  }
}

function problemCategoriesFromMom(liveMonthOverMonth) {
  const changes = liveMonthOverMonth?.categoryChanges ?? []
  return changes
    .filter((entry) => entry.delta?.direction === 'up' && (entry.delta?.percent ?? 0) >= 15)
    .sort((left, right) => (right.delta?.percent ?? 0) - (left.delta?.percent ?? 0))
    .slice(0, 3)
    .map((entry) => ({
      category: entry.category,
      currentTotal: roundCurrency(entry.currentTotal),
      percentUp: entry.delta?.percent ?? null,
    }))
}

/**
 * Loads weekly + monthly + memory slices for chat (best-effort; never throws).
 */
export async function loadChatPmfContext(userId, { liveMonthOverMonth = null } = {}) {
  const [weeklyRaw, monthRaw, tracker, actions, followUps] = await Promise.all([
    buildWeeklyReviewForUser(userId).catch(() => null),
    buildMonthConditionLetterForUser(userId).catch(() => null),
    buildTrackerSnapshotWithFallback(userId).catch(() => null),
    listRecentActions(userId, { limit: 15 }).catch(() => []),
    buildWeeklyActionFollowUps(userId).catch(() => []),
  ])

  const weeklyReview = slimWeeklyReviewForChat(weeklyRaw)
  const monthCondition = slimMonthConditionForChat(monthRaw)

  const openActions = (actions ?? [])
    .filter((action) => action.status === 'accepted' || action.status === 'suggested')
    .slice(0, 5)
    .map((action) => ({
      id: action.id,
      description: action.description,
      status: action.status,
      source: action.source,
      weekStartOn: action.weekStartOn,
    }))

  const recentResolvedActions = (actions ?? [])
    .filter((action) => ['done', 'skipped', 'dismissed'].includes(action.status))
    .slice(0, 5)
    .map((action) => ({
      description: action.description,
      status: action.status,
      outcomeSummary: action.outcomeSummary,
    }))

  const userMemory = buildUserMemoryForChat({
    payday: tracker?.payday ?? weeklyRaw?.payday ?? null,
    whatsLeft: tracker?.whatsLeftUntilPayday ?? weeklyRaw?.whatsLeft ?? null,
    categorySoftLimits: tracker?.categorySoftLimits ?? [],
    savingTrackers: tracker?.savingTrackers ?? [],
    problemCategories: problemCategoriesFromMom(liveMonthOverMonth),
    openActions,
    recentResolvedActions,
    followUps: (followUps ?? []).slice(0, 3).map((item) => ({
      summary: item.summary,
      status: item.status,
    })),
  })

  return {
    weeklyReview,
    monthCondition,
    openActions,
    userMemory,
  }
}
