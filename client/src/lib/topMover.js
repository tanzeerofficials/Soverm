export const SIGNIFICANT_CATEGORY_CHANGE_PERCENT = 5

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
  const { category, direction, percent } = topMover

  if (direction === 'down' && percent != null) {
    return `${category} is your biggest spending improvement, down ${percent}% vs the prior 30 days`
  }

  if (direction === 'up' && percent != null) {
    return `${category} is your fastest-growing category, up ${percent}% vs the prior 30 days`
  }

  return null
}

export function topMoverHeadlineStyles(direction) {
  if (direction === 'down') {
    return { color: 'text-[#10B981]', icon: '📈' }
  }

  return { color: 'text-[#F59E0B]', icon: '⚠️' }
}
