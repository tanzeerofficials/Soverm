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
  const displayCategory =
    typeof topMover.displayCategory === 'string' ? topMover.displayCategory : category

  if (direction === 'down' && percent != null) {
    return `${displayCategory} is your biggest spending improvement, down ${percent}% vs the prior 30 days`
  }

  if (direction === 'up' && percent != null) {
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
