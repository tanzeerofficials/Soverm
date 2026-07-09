/*
 * Spending-cap warning thresholds — shared client helpers.
 *
 * Users can set:
 * - alertWarningPercent: warn when % of cap used reaches this
 * - alertRemainingDollars: warn when dollars left drop to this
 *
 * If neither is set, default is 80%. If both are set, either can trigger.
 */

export const DEFAULT_SPENDING_CAP_WARNING_PERCENT = 80

export function resolveSpendingAlertThresholds(tracker = {}) {
  const hasPercent = tracker.alertWarningPercent != null
  const hasDollars = tracker.alertRemainingDollars != null

  return {
    warningPercent: hasPercent
      ? tracker.alertWarningPercent
      : hasDollars
        ? null
        : DEFAULT_SPENDING_CAP_WARNING_PERCENT,
    remainingDollars: hasDollars ? tracker.alertRemainingDollars : null,
    usesCustomThresholds: hasPercent || hasDollars,
  }
}

export function isSpendingCapWarningActive(tracker, progress) {
  if (!progress || progress.isOver) {
    return false
  }

  const thresholds = resolveSpendingAlertThresholds(tracker)
  const percentHit =
    thresholds.warningPercent != null && progress.percentUsed >= thresholds.warningPercent
  const dollarsHit =
    thresholds.remainingDollars != null &&
    progress.remaining <= thresholds.remainingDollars

  return percentHit || dollarsHit
}

export function describeSpendingAlertThresholds(tracker) {
  const thresholds = resolveSpendingAlertThresholds(tracker)
  const parts = []

  if (thresholds.warningPercent != null) {
    parts.push(`${thresholds.warningPercent}% used`)
  }
  if (thresholds.remainingDollars != null) {
    parts.push(
      `$${Number(thresholds.remainingDollars).toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })} left`
    )
  }

  if (parts.length === 0) {
    return `Warn at ${DEFAULT_SPENDING_CAP_WARNING_PERCENT}% used`
  }

  return `Warn at ${parts.join(' or ')}`
}
