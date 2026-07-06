/*
 * Annual recurring display — monthly total × 12, no extra backend logic.
 */

export function annualizeRecurringMonthly(monthlyTotal) {
  const monthly = Number(monthlyTotal)

  if (!Number.isFinite(monthly) || monthly <= 0) {
    return 0
  }

  return Math.round(monthly * 12 * 100) / 100
}
