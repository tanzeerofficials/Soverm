export const SIGNIFICANT_CATEGORY_CHANGE_PERCENT = 5

function formatMoneyAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return null
  }

  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatTimesMultiplier(times) {
  if (times == null || !Number.isFinite(Number(times)) || Number(times) <= 0) {
    return null
  }

  const value = Number(times)
  if (value >= 10) {
    return `${Math.round(value)}×`
  }

  const oneDecimal = Math.round(value * 10) / 10
  return Number.isInteger(oneDecimal) ? `${oneDecimal}×` : `${oneDecimal.toFixed(1)}×`
}

export function isNotableTopMover(topMover) {
  if (!topMover) {
    return false
  }

  if (topMover.direction === 'flat') {
    return false
  }

  if (topMover.percent == null) {
    return false
  }

  return topMover.percent >= SIGNIFICANT_CATEGORY_CHANGE_PERCENT
}

export function buildTopMoverHeadline(topMover) {
  const { category, direction, percent, currentTotal, priorTotal } = topMover
  const displayCategory =
    typeof topMover.displayCategory === 'string' ? topMover.displayCategory : category

  const times =
    priorTotal > 0 && currentTotal != null
      ? currentTotal / priorTotal
      : percent != null
        ? 1 + ((direction === 'down' ? -1 : 1) * percent) / 100
        : null
  const timesLabel = formatTimesMultiplier(times)
  const currentLabel = formatMoneyAmount(currentTotal)
  const priorLabel = formatMoneyAmount(priorTotal)
  const moneyBit =
    currentLabel && priorLabel ? ` — ${currentLabel} vs ${priorLabel}` : ''

  if (direction === 'down' && (timesLabel || percent != null)) {
    if (timesLabel) {
      return `${displayCategory} is your biggest spending improvement, now about ${timesLabel} the prior 30 days${moneyBit}`
    }
    return `${displayCategory} is your biggest spending improvement, down ${percent}% vs the prior 30 days`
  }

  if (direction === 'up' && (timesLabel || percent != null)) {
    if (timesLabel) {
      return `${displayCategory} is your fastest-growing category, about ${timesLabel} the prior 30 days${moneyBit}`
    }
    return `${displayCategory} is your fastest-growing category, up ${percent}% vs the prior 30 days`
  }

  return null
}

export function topMoverHeadlineStyles(direction) {
  if (direction === 'down') {
    return { color: 'text-brand-soft', badgeVariant: 'improvement' }
  }

  return { color: 'text-warning', badgeVariant: 'spike' }
}
