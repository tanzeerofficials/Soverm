/*
 * TOP CATEGORY MOVER COPY
 *
 * Calmer, advisory language for category swings — inform, don’t alarm.
 * Avoid “21×” / “fastest-growing” framing that can feel like a scare.
 */

export const SIGNIFICANT_CATEGORY_CHANGE_PERCENT = 5
export const SIGNIFICANT_NEW_CATEGORY_ABSOLUTE = 50

function formatMoneyAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return null
  }

  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function isNotableTopMover(topMover) {
  if (!topMover) {
    return false
  }

  if (topMover.isNewCategory) {
    return (topMover.absoluteChange ?? topMover.currentTotal ?? 0) >= SIGNIFICANT_NEW_CATEGORY_ABSOLUTE
  }

  if (topMover.direction === 'flat') {
    return false
  }

  if (topMover.percent == null) {
    return false
  }

  return topMover.percent >= SIGNIFICANT_CATEGORY_CHANGE_PERCENT
}

/*
 * What this does: builds a short, calm note about a category that moved.
 * Why: users should feel informed (“worth a look”), not worried (“21× spike”).
 */
export function buildTopMoverHeadline(topMover) {
  const { category, direction, currentTotal, priorTotal } = topMover
  const displayCategory =
    typeof topMover.displayCategory === 'string' ? topMover.displayCategory : category

  const currentLabel = formatMoneyAmount(currentTotal)
  const priorLabel = formatMoneyAmount(priorTotal)

  if (topMover.isNewCategory) {
    if (currentLabel) {
      return `Worth a quick look: ${displayCategory} is new this period at ${currentLabel} (nothing in the prior period). Open that category when you can — just a heads-up.`
    }
    return `Worth a quick look: ${displayCategory} showed up this period with no spend in the prior 30 days. Open the category when you can.`
  }

  if (direction === 'down') {
    if (currentLabel && priorLabel) {
      return `${displayCategory} is quieter this period — ${currentLabel}, down from ${priorLabel} before. Nice progress if that was intentional.`
    }
    return `${displayCategory} spending is lower than the prior 30 days. Worth a glance if you want to keep that going.`
  }

  if (direction === 'up') {
    if (currentLabel && priorLabel) {
      return `Worth a quick look: ${displayCategory} is at ${currentLabel} this period (was ${priorLabel} before). Soverm suggests reviewing that category when you have a minute — just a heads-up, not a red alert.`
    }
    return `Worth a quick look: ${displayCategory} ran higher than the prior 30 days. Open the category when you can — no rush, just a heads-up.`
  }

  return null
}

export function topMoverHeadlineStyles(direction) {
  if (direction === 'down') {
    return { color: 'text-brand-soft', badgeVariant: 'improvement' }
  }

  // Soft info tone — not a red “spending spike” alarm.
  return { color: 'text-fg', badgeVariant: 'heads_up' }
}
