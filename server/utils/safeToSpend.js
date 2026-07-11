/*
 * SAFE-TO-SPEND CALCULATION
 *
 * Pure helpers for monthly budget progress and the safe-to-spend number.
 * Calendar-month windows come from calendarMonth.js (app timezone).
 */

import {
  formatIsoDateInAppTz,
  getCalendarMonthWindow as getZonedCalendarMonthWindow,
} from './calendarMonth.js'

export function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

/** @deprecated Prefer formatIsoDateInAppTz — kept for call sites that pass local Dates. */
export function formatIsoDate(date) {
  return formatIsoDateInAppTz(date)
}

/**
 * Returns calendar-month window metadata for labels and queries.
 * Delegates to the shared APP_TIMEZONE helper.
 */
export function getCalendarMonthWindow(referenceDate = new Date()) {
  return getZonedCalendarMonthWindow(referenceDate)
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
