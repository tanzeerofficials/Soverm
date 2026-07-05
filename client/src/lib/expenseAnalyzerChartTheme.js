/*
 * Expense Analyzer chart colors — matches existing Soverm UI (InsightCard, StatDeltaBadge, etc.)
 */

export const CHART_PURPLE = '#8B5CF6'
export const CHART_PURPLE_SOFT = '#C4B5FD'
export const CHART_PURPLE_MID = '#7C3AED'
export const CHART_PURPLE_MUTED = '#A78BFA'

export const CHART_BAR_SEQUENCE = [
  CHART_PURPLE,
  CHART_PURPLE_SOFT,
  CHART_PURPLE_MID,
  CHART_PURPLE_MUTED,
]

export const CHART_BAR_TRACK = '#1A2236'
export const CHART_TICK = '#9CA3AF'
export const CHART_VALUE = '#F9FAFB'

export const SPARKLINE_POSITIVE = '#10B981'
export const SPARKLINE_NEGATIVE = '#EF4444'
export const SPARKLINE_NEUTRAL = '#9CA3AF'

export function truncateChartLabel(label, maxLength = 22) {
  if (!label || label.length <= maxLength) {
    return label
  }

  return `${label.slice(0, maxLength - 1)}…`
}

export function formatChartCurrency(amount, compact = false) {
  const value = Number(amount)

  if (compact && value >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}
