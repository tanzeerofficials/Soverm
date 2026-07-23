/*
 * MONTH CONDITION LETTER (pure helpers)
 *
 * Accountant-style month summary: income vs spend, drivers, grade, next plan.
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
 * M2 — income vs spending narrative.
 */
export function buildIncomeVsSpending({
  income = 0,
  spent = 0,
  byKind = null,
  selfTransfers = 0,
  internalMoved = 0,
  liabilityPayments = 0,
} = {}) {
  const incomeAmount = roundCurrency(income)
  const spentAmount = roundCurrency(spent)
  const net = roundCurrency(incomeAmount - spentAmount)
  const selfTransferAmount = roundCurrency(
    selfTransfers || internalMoved || byKind?.self_transfer || 0
  )

  let outcome = 'flat'
  let summary
  if (incomeAmount <= 0 && spentAmount <= 0) {
    outcome = 'unknown'
    summary = 'Not enough external money in and out posted this month yet to judge the month.'
  } else if (net > 5) {
    outcome = 'surplus'
    summary = `You brought in ${formatMoney(incomeAmount)} and spent ${formatMoney(spentAmount)} — a surplus of ${formatMoney(net)}.`
  } else if (net < -5) {
    outcome = 'deficit'
    summary = `You brought in ${formatMoney(incomeAmount)} and spent ${formatMoney(spentAmount)} — about ${formatMoney(Math.abs(net))} more went out than came in this month. Worth a calm review of where it went.`
  } else {
    outcome = 'breakeven'
    summary = `You roughly broke even: ${formatMoney(incomeAmount)} in, ${formatMoney(spentAmount)} out.`
  }

  return {
    income: incomeAmount,
    spent: spentAmount,
    moneyIn: incomeAmount,
    moneyOut: spentAmount,
    net,
    outcome,
    summary,
    byKind: byKind ?? null,
    selfTransfers: selfTransferAmount,
    internalMoved: selfTransferAmount,
    liabilityPayments: roundCurrency(liabilityPayments),
  }
}

/**
 * M4 — fixed (recurring) vs flexible load.
 */
export function buildBillsLoad({ spent = 0, income = 0, recurringMonthly = 0 } = {}) {
  const spentAmount = roundCurrency(spent)
  const incomeAmount = roundCurrency(income)
  const fixed = roundCurrency(Math.min(recurringMonthly, spentAmount))
  const flexible = roundCurrency(Math.max(0, spentAmount - fixed))
  const fixedShareOfSpend =
    spentAmount > 0 ? Math.round((fixed / spentAmount) * 100) : null
  const fixedShareOfIncome =
    incomeAmount > 0 ? Math.round((fixed / incomeAmount) * 100) : null

  return {
    recurringMonthly: roundCurrency(recurringMonthly),
    fixedObligations: fixed,
    flexibleSpend: flexible,
    fixedShareOfSpend,
    fixedShareOfIncome,
    summary:
      incomeAmount > 0
        ? `Known recurring load is about ${formatMoney(recurringMonthly)}/mo (${fixedShareOfIncome}% of income). Flexible spend this month: ${formatMoney(flexible)}.`
        : `Known recurring load is about ${formatMoney(recurringMonthly)}/mo. Flexible spend this month: ${formatMoney(flexible)}.`,
  }
}

/**
 * M5 — buffer / emergency posture from balance vs monthly burn.
 */
export function buildBufferPosture({ netBalance = 0, spent = 0, dayOfMonth = 1 } = {}) {
  const balance = roundCurrency(netBalance)
  const days = Math.max(1, dayOfMonth)
  const dailyBurn = roundCurrency(spent / days)
  const runwayDays =
    dailyBurn > 0 ? Math.round((balance / dailyBurn) * 10) / 10 : null

  let posture = 'unknown'
  let summary
  if (balance <= 0) {
    posture = 'critical'
    summary =
      'Connected balances are at or below zero — worth pausing new spending and reviewing what’s due next.'
  } else if (runwayDays != null && runwayDays < 7) {
    posture = 'fragile'
    summary = `About ${runwayDays} days of runway at this month’s spend pace. Worth keeping a close eye on upcoming bills.`
  } else if (runwayDays != null && runwayDays < 21) {
    posture = 'thin'
    summary = `Roughly ${runwayDays} days of runway at this month’s pace. Thin, but not empty.`
  } else if (runwayDays != null) {
    posture = 'ok'
    summary = `About ${runwayDays} days of runway at this month’s pace — still build a small cash buffer when you can.`
  } else {
    posture = 'ok'
    summary = `Balance is ${formatMoney(balance)}. Low spend so far makes runway hard to estimate — keep a cash cushion anyway.`
  }

  return {
    netBalance: balance,
    dailyBurn,
    runwayDays,
    posture,
    summary,
  }
}

/**
 * M6 — vs prior month (overall headline + biggest category movers).
 *
 * Why movers: total spending/income alone hides where the month changed
 * (Healthcare vs Dining vs Peer transfer). Floor keeps $2 noise out.
 */
export const MONTH_OVER_MONTH_MOVER_FLOOR = 25
export const MONTH_OVER_MONTH_MOVER_LIMIT = 5

export function buildCategoryMovers(
  currentByCategory = {},
  priorByCategory = {},
  { floor = MONTH_OVER_MONTH_MOVER_FLOOR, limit = MONTH_OVER_MONTH_MOVER_LIMIT } = {}
) {
  const keys = new Set([
    ...Object.keys(currentByCategory ?? {}),
    ...Object.keys(priorByCategory ?? {}),
  ])

  const movers = []
  for (const category of keys) {
    const current = roundCurrency(currentByCategory[category] ?? 0)
    const prior = roundCurrency(priorByCategory[category] ?? 0)
    const delta = roundCurrency(current - prior)
    if (Math.abs(delta) < floor) {
      continue
    }

    const isNew = prior <= 0 && current > 0
    const direction = delta > 0 ? 'up' : 'down'
    let detail
    if (isNew) {
      detail = `${category} ${formatMoney(current)} this month (new vs last month)`
    } else if (direction === 'up') {
      detail = `${category} up ${formatMoney(Math.abs(delta))} vs last month`
    } else {
      detail = `${category} down ${formatMoney(Math.abs(delta))} vs last month`
    }

    movers.push({
      category,
      current,
      prior,
      delta,
      direction,
      isNew,
      detail,
    })
  }

  return movers
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, limit)
}

export function buildMonthOverMonth({
  spent = 0,
  priorSpent = 0,
  income = 0,
  priorIncome = 0,
  netBalance = 0,
  priorNetApprox = null,
  currentByCategory = {},
  priorByCategory = {},
} = {}) {
  const spendDelta = roundCurrency(spent - priorSpent)
  const incomeDelta = roundCurrency(income - priorIncome)

  let spendTrend = 'flat'
  if (Math.abs(spendDelta) >= 1) {
    spendTrend = spendDelta > 0 ? 'worse' : 'better'
  }

  let incomeTrend = 'flat'
  if (Math.abs(incomeDelta) >= 1) {
    incomeTrend = incomeDelta > 0 ? 'better' : 'worse'
  }

  const parts = []
  if (priorSpent > 0 || spent > 0) {
    if (spendTrend === 'better') {
      parts.push(`Spending is down ${formatMoney(Math.abs(spendDelta))} vs last month.`)
    } else if (spendTrend === 'worse') {
      parts.push(`Spending is up ${formatMoney(Math.abs(spendDelta))} vs last month.`)
    } else {
      parts.push('Spending is about flat vs last month.')
    }
  }
  if (priorIncome > 0 || income > 0) {
    if (incomeTrend === 'better') {
      parts.push(`Income is up ${formatMoney(Math.abs(incomeDelta))}.`)
    } else if (incomeTrend === 'worse') {
      parts.push(`Income is down ${formatMoney(Math.abs(incomeDelta))}.`)
    }
  }

  const movers = buildCategoryMovers(currentByCategory, priorByCategory)

  return {
    spendDelta,
    incomeDelta,
    spendTrend,
    incomeTrend,
    summary: parts.join(' ') || 'Not enough prior-month data for a clean comparison yet.',
    movers,
    priorSpent: roundCurrency(priorSpent),
    priorIncome: roundCurrency(priorIncome),
    netBalance: roundCurrency(netBalance),
    priorNetApprox: priorNetApprox != null ? roundCurrency(priorNetApprox) : null,
  }
}

/**
 * M7 — On track / Room to improve / Let's plan ahead.
 * Calm labels: motivate + point to Soverm tools (tracker, category limits).
 */
export function gradeMonthCondition({
  cashFlow,
  billsLoad,
  buffer,
} = {}) {
  let grade = 'stable'
  let title = 'On track'
  let summary =
    'You’re covering the month with some breathing room. Keep a spending tracker handy so next month stays this smooth.'

  if (
    cashFlow?.outcome === 'deficit' ||
    buffer?.posture === 'critical' ||
    (buffer?.posture === 'fragile' && cashFlow?.outcome !== 'surplus')
  ) {
    grade = 'at_risk'
    title = 'Let’s finish strong'
    summary =
      'You can still shape how this month ends. Set up a spending tracker and a category limit on your biggest flexible spend — those two tools make it much easier to finish on your terms.'
  } else if (
    cashFlow?.outcome === 'breakeven' ||
    buffer?.posture === 'thin' ||
    buffer?.posture === 'fragile' ||
    (billsLoad?.fixedShareOfIncome != null && billsLoad.fixedShareOfIncome >= 45)
  ) {
    grade = 'tight'
    title = 'Room to improve'
    summary =
      'A small setup goes a long way: add a spending tracker and a soft category limit so the rest of the month stays intentional — not guessed.'
  } else if (cashFlow?.outcome === 'surplus') {
    summary =
      'Income covered spending with a little left over — nice work. Lock it in with a tracker so that cushion sticks.'
  }

  return { grade, title, summary, reasons: [] }
}

/**
 * M8 — 2–3 concrete next-month moves.
 */
export function buildNextMonthPlan({
  grade,
  cashFlow,
  topCategories = [],
  billsLoad,
  whatsLeftAmount = null,
} = {}) {
  const moves = []

  if (grade === 'at_risk' || cashFlow?.outcome === 'deficit') {
    moves.push({
      id: 'set-tracker',
      title: 'Turn on a spending tracker',
      detail:
        'Pick one number to watch (a weekly or monthly cap). Seeing progress in one place makes the month feel doable.',
      href: '/dashboard?tab=tools',
    })
    moves.push({
      id: 'category-cap',
      title: 'Set a category spending limit',
      detail:
        topCategories[0]
          ? `Start with ${topCategories[0].category} (${formatMoney(topCategories[0].amount)} this month) — a soft limit there helps the rest of your budget breathe.`
          : 'Choose your biggest flexible category and set a soft limit below this month’s spend.',
      href: '/expense-analyzer?tab=categories',
    })
    moves.push({
      id: 'weekly-checkin',
      title: 'Check Your week once mid-month',
      detail: 'A quick look at what’s left until payday keeps small leaks from stacking up.',
      href: '/weekly-review',
    })
  } else if (grade === 'tight') {
    moves.push({
      id: 'set-tracker',
      title: 'Add a spending tracker',
      detail: 'One clear cap on Home → Quick tools turns “I think I’m fine” into a number you can trust.',
      href: '/dashboard?tab=tools',
    })
    moves.push({
      id: 'category-cap',
      title: topCategories[0] ? `Limit ${topCategories[0].category}` : 'Set a category limit',
      detail: topCategories[0]
        ? `A soft cap under ${formatMoney(topCategories[0].amount)} keeps that category from quietly eating the month.`
        : 'Cap one flexible category so the rest of the month stays intentional.',
      href: '/expense-analyzer?tab=categories',
    })
  } else {
    const park =
      whatsLeftAmount != null && whatsLeftAmount > 50
        ? Math.min(75, Math.floor(whatsLeftAmount * 0.15))
        : cashFlow?.net > 50
          ? Math.min(75, Math.floor(cashFlow.net * 0.2))
          : 25
    moves.push({
      id: 'park-buffer',
      title: `Park about ${formatMoney(park)} toward a buffer`,
      detail: 'Even a small cushion makes next month feel easier — use a savings tracker if you want it automatic.',
      href: '/dashboard?tab=tools',
    })
    if (billsLoad?.recurringMonthly > 0) {
      moves.push({
        id: 'review-subs',
        title: 'Review one subscription',
        detail: `Recurring load is ~${formatMoney(billsLoad.recurringMonthly)}/mo — cancel or downgrade one you don’t use.`,
        href: '/expense-analyzer?tab=recurring',
      })
    }
  }

  if (moves.length < 2) {
    moves.push({
      id: 'weekly-checkin',
      title: 'Keep the weekly check-in',
      detail: 'Open Your week once a week so small leaks don’t become month-end surprises.',
      href: '/weekly-review',
    })
  }

  return moves.slice(0, 3)
}

/**
 * Assemble the full letter payload (pure).
 */
export function buildMonthConditionLetter({
  monthKey,
  monthLabel,
  periodLabel,
  isCurrentMonth,
  isComplete,
  income,
  spent,
  netBalance,
  topCategories = [],
  recurringMonthly = 0,
  priorIncome = 0,
  priorSpent = 0,
  currentByCategory = {},
  priorByCategory = {},
  dayOfMonth = 1,
  whatsLeftAmount = null,
  byKind = null,
  selfTransfers = 0,
  internalMoved = 0,
  liabilityPayments = 0,
} = {}) {
  const cashFlow = buildIncomeVsSpending({
    income,
    spent,
    byKind,
    selfTransfers,
    internalMoved,
    liabilityPayments,
  })
  const drivers = topCategories.slice(0, 3).map((entry) => ({
    category: entry.category,
    amount: roundCurrency(entry.amount ?? entry.currentTotal ?? 0),
    percentOfTotal: entry.percentOfTotal ?? null,
  }))
  const billsLoad = buildBillsLoad({ spent, income, recurringMonthly })
  const buffer = buildBufferPosture({ netBalance, spent, dayOfMonth })
  const vsLastMonth = buildMonthOverMonth({
    spent,
    priorSpent,
    income,
    priorIncome,
    netBalance,
    currentByCategory,
    priorByCategory,
  })
  const condition = gradeMonthCondition({ cashFlow, billsLoad, buffer })
  const nextMonthPlan = buildNextMonthPlan({
    grade: condition.grade,
    cashFlow,
    topCategories: drivers,
    billsLoad,
    whatsLeftAmount,
  })

  const headline =
    isCurrentMonth && !isComplete
      ? `${monthLabel} so far — ${condition.title}`
      : `${monthLabel} — ${condition.title}`

  return {
    monthKey,
    monthLabel,
    periodLabel,
    isCurrentMonth,
    isComplete,
    headline,
    cashFlow,
    drivers,
    billsLoad,
    buffer,
    vsLastMonth,
    condition,
    nextMonthPlan,
  }
}
