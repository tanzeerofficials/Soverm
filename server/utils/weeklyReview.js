/*
 * WEEKLY REVIEW (pure helpers)
 *
 * Builds the four ICP blocks: how you did, what's left, one risk, one move.
 */

import { roundCurrency } from './safeToSpend.js'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

/**
 * Plain-English "how you did this week" from spend totals + top categories.
 */
export function buildHowYouDid({
  spentThisWeek = 0,
  spentPriorWeek = 0,
  topCategories = [],
  sparse = false,
} = {}) {
  const current = roundCurrency(spentThisWeek)
  const prior = roundCurrency(spentPriorWeek)
  const delta = roundCurrency(current - prior)
  const hasPrior = prior > 0

  let direction = 'flat'
  let percent = null
  if (hasPrior && Math.abs(delta) >= 1) {
    direction = delta > 0 ? 'up' : 'down'
    percent = Math.round((Math.abs(delta) / prior) * 100)
  }

  let summary
  if (sparse) {
    summary =
      current > 0
        ? `You’ve spent ${formatMoney(current)} so far this week. We’re still learning your pattern — check back after a few more days of transactions.`
        : `Not enough transaction history yet for a full week comparison. Connect and sync, then check back mid-week.`
  } else if (!hasPrior && current === 0) {
    summary = `No spending posted this week yet.`
  } else if (!hasPrior) {
    summary = `You spent ${formatMoney(current)} this week. We’ll compare to last week once we have a full prior week.`
  } else if (direction === 'flat') {
    summary = `You spent ${formatMoney(current)} this week — about the same as last week (${formatMoney(prior)}).`
  } else if (direction === 'up') {
    summary = `You spent ${formatMoney(current)} this week, up ${percent}% vs last week (${formatMoney(prior)}).`
  } else {
    summary = `You spent ${formatMoney(current)} this week, down ${percent}% vs last week (${formatMoney(prior)}).`
  }

  const drivers = topCategories.slice(0, 2).map((entry) => ({
    category: entry.category,
    amount: roundCurrency(entry.amount),
  }))

  if (drivers.length > 0 && !sparse) {
    const driverText = drivers
      .map((d) => `${d.category} (${formatMoney(d.amount)})`)
      .join(' and ')
    summary += ` Biggest drivers: ${driverText}.`
  }

  return {
    spentThisWeek: current,
    spentPriorWeek: prior,
    delta,
    direction,
    percent,
    summary,
    topCategories: drivers,
    sparse,
  }
}

/**
 * Pick a single highest-priority risk for the week.
 */
export function pickOneRisk({
  whatsLeft = null,
  categorySoftLimits = [],
  spendingTracker = null,
  sparse = false,
  runwayVerdict = null,
} = {}) {
  if (sparse && (!whatsLeft || !whatsLeft.configured)) {
    return {
      id: 'sparse-data',
      tone: 'neutral',
      title: 'Still getting to know your money',
      detail:
        'With less than a week of solid history, treat this review as a preview. Bills and payday remaining still help when payday is set.',
    }
  }

  if (runwayVerdict === 'at_risk') {
    return {
      id: 'runway-at-risk',
      tone: 'danger',
      title: 'Runway to payday needs attention',
      detail:
        'At this week’s spend pace (or after known bills), cash looks tight before payday. Worth reviewing what’s left and one bill or category to ease pressure.',
    }
  }

  const overLimit = (categorySoftLimits ?? []).find((limit) => limit.isOver)
  if (overLimit) {
    return {
      id: `category-over-${overLimit.category}`,
      tone: 'danger',
      title: `${overLimit.category} is over its category cap`,
      detail: `${formatMoney(overLimit.spentThisMonth)} of ${formatMoney(overLimit.monthlyLimit)} this month.`,
    }
  }

  const progress = spendingTracker?.progress
  if (progress?.isOver) {
    return {
      id: 'spending-cap-over',
      tone: 'danger',
      title: 'Spending cap exceeded',
      detail: `Over by ${formatMoney(progress.overBy)} this month.`,
    }
  }

  if (whatsLeft?.configured && whatsLeft.amount === 0 && whatsLeft.billsUntilPaydayTotal > 0) {
    return {
      id: 'bills-eat-balance',
      tone: 'danger',
      title: 'Known bills use up what’s left',
      detail: `${formatMoney(whatsLeft.billsUntilPaydayTotal)} in bills before payday leaves $0 free after your balance.`,
    }
  }

  const nearLimit = (categorySoftLimits ?? []).find((limit) => limit.isWarning)
  if (nearLimit) {
    return {
      id: `category-warn-${nearLimit.category}`,
      tone: 'warning',
      title: `${nearLimit.category} is near its category cap`,
      detail: `${nearLimit.percentUsed}% used (${formatMoney(nearLimit.spentThisMonth)} of ${formatMoney(nearLimit.monthlyLimit)}).`,
    }
  }

  if (progress && !progress.isOver && progress.percentUsed >= 80) {
    return {
      id: 'spending-cap-warning',
      tone: 'warning',
      title: 'Approaching your spending cap',
      detail: `${progress.percentUsed}% of your monthly cap used · ${formatMoney(progress.remaining)} left.`,
    }
  }

  if (
    whatsLeft?.configured &&
    whatsLeft.daysUntilPayday != null &&
    whatsLeft.daysUntilPayday <= 3 &&
    whatsLeft.amount < 50
  ) {
    return {
      id: 'tight-to-payday',
      tone: 'warning',
      title: 'Tight until payday',
      detail: `${formatMoney(whatsLeft.amount)} left with ${whatsLeft.daysUntilPayday} day${whatsLeft.daysUntilPayday === 1 ? '' : 's'} to go.`,
    }
  }

  if (whatsLeft?.configured && whatsLeft.bills?.length > 0) {
    const nextBill = whatsLeft.bills[0]
    return {
      id: 'upcoming-bill',
      tone: 'neutral',
      title: `Next bill: ${nextBill.merchant}`,
      detail: `${formatMoney(nextBill.amount)} on ${nextBill.date}.`,
    }
  }

  return {
    id: 'all-clear',
    tone: 'brand',
    title: 'No urgent risks this week',
    detail: 'Keep an eye on discretionary spend and check back before the weekend.',
  }
}

/**
 * One affordable next move constrained by remaining money.
 */
export function pickOneMove({
  whatsLeft = null,
  risk = null,
  paydayConfigured = false,
  runwayVerdict = null,
} = {}) {
  if (!paydayConfigured) {
    return {
      id: 'confirm-payday',
      title: 'Confirm your payday',
      detail:
        'Set when you get paid so we can show what’s left after bills — the number that matters most week to week.',
      href: '/weekly-review',
      actionLabel: 'Edit payday below',
    }
  }

  if (runwayVerdict === 'at_risk' || risk?.id === 'runway-at-risk') {
    return {
      id: 'protect-essentials',
      title: 'Protect essentials until payday',
      detail: 'Only spend on must-haves. Delay anything that can wait until your next deposit.',
      href: '/weekly-review',
      actionLabel: 'Got it',
    }
  }

  if (runwayVerdict === 'tight') {
    return {
      id: 'slow-pace',
      title: 'Slow this week’s pace',
      detail: 'Cut one discretionary habit (delivery, shopping) until payday so the runway stays green.',
      href: '/weekly-review',
      actionLabel: 'Got it',
    }
  }

  if (risk?.id?.startsWith('category-over') || risk?.id?.startsWith('category-warn')) {
    return {
      id: 'review-category-limit',
      title: 'Review that category limit',
      detail: 'Pause non-essential spend in that category until next month, or adjust the category cap if it was unrealistic.',
      href: '/expense-analyzer?tab=categories',
      actionLabel: 'Open categories',
    }
  }

  if (risk?.id === 'spending-cap-over' || risk?.id === 'spending-cap-warning') {
    return {
      id: 'slow-discretionary',
      title: 'Slow discretionary spending',
      detail: 'Hold restaurant / shopping trips until the cap recovers or the month resets.',
      href: '/dashboard?tab=tools',
      actionLabel: 'View tracker',
    }
  }

  if (risk?.id === 'bills-eat-balance' || risk?.id === 'tight-to-payday') {
    return {
      id: 'protect-essentials',
      title: 'Protect essentials until payday',
      detail: 'Only spend on must-haves. Delay anything that can wait until your next deposit.',
      href: '/weekly-review',
      actionLabel: 'Got it',
    }
  }

  const amount = whatsLeft?.amount
  const days = whatsLeft?.daysUntilPayday
  if (amount != null && days != null && days > 0 && amount / days >= 40) {
    const suggest = Math.min(50, Math.floor(amount * 0.1))
    if (suggest >= 10) {
      return {
        id: 'park-small-buffer',
        title: `Park about ${formatMoney(suggest)} if you can`,
        detail: `You have ${formatMoney(amount)} left over ${days} days. Moving a little aside builds a tiny buffer for surprises.`,
        href: '/dashboard?tab=tools',
        actionLabel: 'Open tracker',
      }
    }
  }

  return {
    id: 'hold-steady',
    title: 'Hold steady this week',
    detail:
      amount != null
        ? `Treat ${formatMoney(amount)} as your ceiling until payday. Recheck before any larger purchase.`
        : 'Recheck mid-week after a few more transactions post.',
    href: '/weekly-review',
    actionLabel: 'Got it',
  }
}
