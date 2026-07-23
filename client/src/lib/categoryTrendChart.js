/*
 * CATEGORY TREND CHART — geometry
 *
 * Pure layout helper for a compact single-series bar trend (one category
 * across its last 3 calendar months). Same split as spendingSparkline.js /
 * cashFlowMonthlyChart.js — geometry here, SVG in CategoryTrendChart.jsx.
 */

export function buildCategoryTrendGeometry(
  months = [],
  { width = 180, height = 56, padding = 4, barGap = 6 } = {}
) {
  if (!months.length) {
    return null
  }

  const max = Math.max(...months.map((month) => month.total), 1)
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const barWidth = (innerWidth - barGap * (months.length - 1)) / months.length

  const bars = months.map((month, index) => {
    const barHeight = (Math.max(month.total, 0) / max) * innerHeight
    return {
      monthKey: month.monthKey,
      monthLabel: month.monthLabel,
      total: month.total,
      x: padding + index * (barWidth + barGap),
      y: padding + innerHeight - barHeight,
      width: Math.max(barWidth, 1),
      height: Math.max(barHeight, 1),
      isLast: index === months.length - 1,
    }
  })

  return { bars, max, width, height }
}
