/*
 * SAFE-TO-SPEND CALCULATION
 *
 * Pure helpers for monthly budget progress and the safe-to-spend number.
 * Calendar-month spending is compared against the user's monthly budget,
 * capped by net balance across connected accounts.
 */

export function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

export function formatIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns calendar-month window metadata for labels and queries.
 */
export function getCalendarMonthWindow(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const today = referenceDate.getDate()
  const periodStart = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const isLastDay = today === lastDayOfMonth

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' })
  const monthLabel = monthFormatter.format(periodStart)
  const periodLabel = isLastDay
    ? `${monthLabel} 1–${lastDayOfMonth}`
    : `${monthLabel} 1–today`

  return {
    periodStart: formatIsoDate(periodStart),
    periodEnd: formatIsoDate(new Date(year, month, lastDayOfMonth)),
    daysLeftInMonth: Math.max(0, lastDayOfMonth - today),
    dayOfMonth: today,
    periodLabel,
    monthLabel,
  }
}

/**
 * Computes safe-to-spend and budget progress from raw inputs.
 * Optional plannedGoalsThisMonth is used only by the pre-013 legacy budget fallback.
 */
export function computeSafeToSpend({
  monthlyBudget = null,
  spentThisMonth = 0,
  netBalance = 0,
  plannedGoalsThisMonth = 0,
}) {
  const spent = roundCurrency(spentThisMonth)
  const balance = roundCurrency(netBalance)
  const plannedGoals = roundCurrency(plannedGoalsThisMonth)

  if (monthlyBudget == null || monthlyBudget <= 0) {
    return {
      configured: false,
      monthlyBudget: null,
      spentThisMonth: spent,
      remainingBudget: null,
      plannedGoalsThisMonth: plannedGoals,
      safeToSpend: null,
      overBudgetBy: null,
      percentUsed: null,
      netBalance: balance,
    }
  }

  const budget = roundCurrency(monthlyBudget)
  const remainingBudget = roundCurrency(budget - spent)
  const remainingAfterGoals = roundCurrency(remainingBudget - plannedGoals)
  const overBudgetBy =
    remainingAfterGoals < 0 ? roundCurrency(Math.abs(remainingAfterGoals)) : 0
  const safeToSpend = roundCurrency(Math.min(balance, Math.max(0, remainingAfterGoals)))
  const percentUsed = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : null

  return {
    configured: true,
    monthlyBudget: budget,
    spentThisMonth: spent,
    remainingBudget,
    plannedGoalsThisMonth: plannedGoals,
    remainingAfterGoals,
    safeToSpend,
    overBudgetBy,
    percentUsed,
    netBalance: balance,
    isOverBudget: remainingAfterGoals < 0,
  }
}
