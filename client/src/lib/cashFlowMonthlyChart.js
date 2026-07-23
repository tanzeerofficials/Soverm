/*
 * CASH FLOW MONTHLY CHART — geometry
 *
 * Pure layout helper for a paired money-in/money-out bar chart across the
 * last few calendar months. No DOM/SVG here — CashFlowMonthlyChart.jsx
 * turns this into <rect> elements. Kept separate so the layout math is
 * independently testable (house pattern — see spendingSparkline.js).
 */

export function buildCashFlowMonthlyGeometry(
  months = [],
  { width = 320, height = 140, padding = 8, barGap = 3, groupGap = 20 } = {}
) {
  if (!months.length) {
    return null
  }

  const max = Math.max(...months.flatMap((month) => [month.moneyIn, month.moneyOut]), 1)
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const groupWidth = (innerWidth - groupGap * (months.length - 1)) / months.length
  const barWidth = (groupWidth - barGap) / 2

  const bars = months.map((month, index) => {
    const groupX = padding + index * (groupWidth + groupGap)
    const inHeight = (Math.max(month.moneyIn, 0) / max) * innerHeight
    const outHeight = (Math.max(month.moneyOut, 0) / max) * innerHeight

    return {
      monthKey: month.monthKey,
      monthLabel: month.monthLabel,
      moneyIn: month.moneyIn,
      moneyOut: month.moneyOut,
      inX: groupX,
      outX: groupX + barWidth + barGap,
      inY: padding + innerHeight - inHeight,
      outY: padding + innerHeight - outHeight,
      inHeight,
      outHeight,
      barWidth: Math.max(barWidth, 1),
      groupCenterX: groupX + groupWidth / 2,
    }
  })

  return {
    bars,
    max,
    width,
    height,
    baselineY: padding + innerHeight,
  }
}

export function hasAnyCashFlowMonthlyData(months = []) {
  return months.some((month) => (month.moneyIn ?? 0) > 0 || (month.moneyOut ?? 0) > 0)
}
