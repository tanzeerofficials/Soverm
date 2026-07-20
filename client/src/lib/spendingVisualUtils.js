import { getChartTheme } from './expenseAnalyzerChartTheme.js'
import { formatCategoryDisplayName } from './categoryDisplayNames.js'

const MAX_SLICES = 5
const OTHER_THRESHOLD_PERCENT = 4

export function sortBySpend(entries) {
  return [...entries].sort((left, right) => right.currentTotal - left.currentTotal)
}

export function prepareDonutSlices(categoryBreakdown) {
  if (!categoryBreakdown?.length) {
    return { slices: [], total: 0 }
  }

  const sorted = sortBySpend(categoryBreakdown)
  const total = sorted.reduce((sum, entry) => sum + entry.currentTotal, 0)

  if (total <= 0) {
    return { slices: [], total: 0 }
  }

  if (sorted.length <= MAX_SLICES) {
    return {
      total,
      slices: sorted.map((entry, index) => toSlice(entry, index, total)),
    }
  }

  const primary = []
  let otherTotal = 0

  for (const entry of sorted) {
    const percent = (entry.currentTotal / total) * 100

    if (primary.length < MAX_SLICES - 1 && percent >= OTHER_THRESHOLD_PERCENT) {
      primary.push(entry)
    } else {
      otherTotal += entry.currentTotal
    }
  }

  const slices = primary.map((entry, index) => toSlice(entry, index, total))
  const barSequence = getChartTheme().barSequence

  if (otherTotal > 0) {
    slices.push({
      key: '__other__',
      label: 'Other',
      amount: otherTotal,
      percent: (otherTotal / total) * 100,
      color: barSequence[slices.length % barSequence.length],
      entry: null,
    })
  }

  return { slices, total }
}

function toSlice(entry, index, total) {
  const barSequence = getChartTheme().barSequence
  return {
    key: entry.category,
    label: formatCategoryDisplayName(entry.category),
    amount: entry.currentTotal,
    percent: (entry.currentTotal / total) * 100,
    color: barSequence[index % barSequence.length],
    entry,
  }
}

export function prepareRecurringSlices(recurringCharges) {
  if (!recurringCharges?.length) {
    return { slices: [], total: 0 }
  }

  const sorted = [...recurringCharges].sort(
    (left, right) =>
      (right.monthlyEquivalent ?? right.averageAmount ?? 0) -
      (left.monthlyEquivalent ?? left.averageAmount ?? 0)
  )

  const total = sorted.reduce(
    (sum, charge) => sum + (charge.monthlyEquivalent ?? charge.averageAmount ?? 0),
    0
  )

  if (total <= 0) {
    return { slices: [], total: 0 }
  }

  const visible = sorted.slice(0, 4)
  const remainder = sorted.slice(4)
  const otherTotal = remainder.reduce(
    (sum, charge) => sum + (charge.monthlyEquivalent ?? charge.averageAmount ?? 0),
    0
  )

  const barSequence = getChartTheme().barSequence
  const slices = visible.map((charge, index) => ({
    key: `${charge.merchant}-${charge.lastChargedDate}`,
    label: charge.merchant,
    amount: charge.monthlyEquivalent ?? charge.averageAmount ?? 0,
    percent: ((charge.monthlyEquivalent ?? charge.averageAmount ?? 0) / total) * 100,
    color: barSequence[index % barSequence.length],
  }))

  if (otherTotal > 0) {
    slices.push({
      key: '__other__',
      label: 'Other',
      amount: otherTotal,
      percent: (otherTotal / total) * 100,
      color: barSequence[slices.length % barSequence.length],
    })
  }

  return { slices, total }
}

export function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  }
}

export function describeDonutSegment(
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle
) {
  const startOuter = polarToCartesian(centerX, centerY, outerRadius, startAngle)
  const endOuter = polarToCartesian(centerX, centerY, outerRadius, endAngle)
  const startInner = polarToCartesian(centerX, centerY, innerRadius, endAngle)
  const endInner = polarToCartesian(centerX, centerY, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

export function buildArcSegments(slices, gapDegrees = 2) {
  const totalGap = gapDegrees * slices.length
  const availableDegrees = 360 - totalGap
  let cursor = 0

  return slices.map((slice) => {
    const sweep = (slice.percent / 100) * availableDegrees
    const segment = {
      ...slice,
      startAngle: cursor,
      endAngle: cursor + sweep,
    }

    cursor += sweep + gapDegrees

    return segment
  })
}

export function formatPercent(percent) {
  if (percent > 0 && percent < 1) {
    return '<1%'
  }

  return `${Math.round(percent * 10) / 10}%`
}
