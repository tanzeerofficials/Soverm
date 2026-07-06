/*
 * CASH FLOW SUMMARY METRICS
 *
 * Pure helpers for income / spend / net — tested independently of React.
 */

export function computeCashFlowMetrics(income = 0, spent = 0) {
  const net = income - spent
  const spendRatio = income > 0 ? Math.min(spent / income, 1) : null
  const spendPercent = spendRatio != null ? Math.round(spendRatio * 100) : null

  return {
    net,
    spendRatio,
    spendPercent,
    netIsPositive: net >= 0,
  }
}
