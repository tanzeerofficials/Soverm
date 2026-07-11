/*
 * MONTHLY TRACKER HELPERS
 *
 * Unified spending cap + savings goal tracking for the calendar month.
 * Spending and saving trackers are independent — saving does not reduce
 * the spending cap automatically.
 */

import { getCurrentProgressMonth as getZonedCurrentProgressMonth } from './calendarMonth.js'
import { formatIsoDate, roundCurrency } from './safeToSpend.js'

export const TRACK_TYPES = ['spending', 'saving']
export const TRACK_PURPOSE_TYPES = ['debt', 'purchase', 'future']
export const MAX_SAVING_TRACKERS = 5
export const MAX_TRACKER_NAME_LENGTH = 80
export const MIN_TRACKER_AMOUNT = 1
export const MAX_TRACKER_AMOUNT = 999_999.99
/** Default warning when the user has not set custom % or $ thresholds. */
export const DEFAULT_SPENDING_CAP_WARNING_PERCENT = 80
export const MIN_ALERT_WARNING_PERCENT = 1
export const MAX_ALERT_WARNING_PERCENT = 99

export function getCurrentProgressMonth(referenceDate = new Date()) {
  return getZonedCurrentProgressMonth(referenceDate)
}

function toProgressMonthIso(value) {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    return value.slice(0, 10)
  }

  // node-pg returns DATE columns as UTC midnight for the calendar date.
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isProgressMonthCurrent(progressMonth, referenceDate = new Date()) {
  if (!progressMonth) {
    return false
  }

  return progressMonth === getCurrentProgressMonth(referenceDate)
}

/**
 * Returns the amount logged for the current calendar month.
 * Stale months (or never logged) read as zero — the server persists the reset.
 */
export function resolveMonthlySaved(tracker, referenceDate = new Date()) {
  if (tracker.trackType !== 'saving') {
    return 0
  }

  if (!isProgressMonthCurrent(tracker.progressMonth, referenceDate)) {
    return 0
  }

  return roundCurrency(tracker.monthlyProgressAmount ?? 0)
}

/**
 * Applies a new monthly saved amount and returns DB fields to write.
 * Lifetime total (progressAmount) moves by the delta vs the previous month value.
 */
export function computeMonthlyProgressUpdate(tracker, newMonthlyAmount, referenceDate = new Date()) {
  const previousMonthly = resolveMonthlySaved(tracker, referenceDate)
  const nextMonthly = roundCurrency(newMonthlyAmount)
  const delta = roundCurrency(nextMonthly - previousMonthly)
  const progressAmount = roundCurrency(Math.max(0, (tracker.progressAmount ?? 0) + delta))

  return {
    monthlyProgressAmount: nextMonthly,
    progressMonth: getCurrentProgressMonth(referenceDate),
    progressAmount,
  }
}

export function mapTrackerRow(row) {
  const monthlyAmount = roundCurrency(row.monthly_amount)
  const targetTotal = row.target_total != null ? roundCurrency(row.target_total) : null
  const progressAmount = roundCurrency(row.progress_amount)
  const monthlyProgressAmount =
    row.monthly_progress_amount != null ? roundCurrency(row.monthly_progress_amount) : 0
  const progressMonth = toProgressMonthIso(row.progress_month)
  const alertWarningPercent =
    row.alert_warning_percent != null ? Number(row.alert_warning_percent) : null
  const alertRemainingDollars =
    row.alert_remaining_dollars != null ? roundCurrency(row.alert_remaining_dollars) : null

  return {
    id: row.id,
    trackType: row.track_type,
    name: row.name || (row.track_type === 'spending' ? 'Monthly spending' : 'Savings goal'),
    purposeType: row.purpose_type,
    monthlyAmount,
    targetTotal,
    progressAmount,
    monthlyProgressAmount,
    progressMonth,
    alertWarningPercent: Number.isFinite(alertWarningPercent) ? alertWarningPercent : null,
    alertRemainingDollars,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Resolves which warning rules apply for a spending tracker.
 * - Neither set → default 80%
 * - Percent and/or dollars set → warn when either rule is crossed
 */
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

/**
 * True when spending is still under the hard cap but has crossed a warning threshold.
 * Dollar rule: remaining budget <= alertRemainingDollars
 * Percent rule: percentUsed >= alertWarningPercent (or default 80%)
 * If both are set, either one can trigger the warning.
 */
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

export function computeSpendingTrackerProgress(tracker, spentThisMonth = 0) {
  const limit = roundCurrency(tracker.monthlyAmount)
  const spent = roundCurrency(spentThisMonth)
  const remaining = roundCurrency(limit - spent)
  const percentUsed = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const isOver = spent > limit
  const progress = {
    spent,
    remaining,
    percentUsed,
    isOver,
    overBy: isOver ? roundCurrency(spent - limit) : 0,
  }

  return {
    ...progress,
    status: isOver
      ? 'over'
      : isSpendingCapWarningActive(tracker, progress)
        ? 'warning'
        : 'on_track',
  }
}

export function parseLoggedProgressAmount(value, fieldName = 'progressAmount') {
  if (value == null || value === '') {
    return { error: `${fieldName} is required` }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return { error: `${fieldName} must be a number` }
  }

  if (parsed < 0 || parsed > MAX_TRACKER_AMOUNT) {
    return { error: `${fieldName} must be between 0 and ${MAX_TRACKER_AMOUNT}` }
  }

  return { value: roundCurrency(parsed) }
}

export function computeSavingTrackerProgress(
  tracker,
  { income = 0, spent = 0, referenceDate = new Date() } = {}
) {
  const monthlyTarget = roundCurrency(tracker.monthlyAmount)
  const savedThisMonth = resolveMonthlySaved(tracker, referenceDate)
  const totalSaved = roundCurrency(tracker.progressAmount ?? 0)
  const paceEstimate = roundCurrency(Math.max(0, income - spent))
  const percentOfMonthly =
    monthlyTarget > 0 ? Math.min(100, Math.round((savedThisMonth / monthlyTarget) * 100)) : 0
  const totalTarget = tracker.targetTotal
  const percentOfTotal =
    totalTarget != null && totalTarget > 0
      ? Math.min(100, Math.round((totalSaved / totalTarget) * 100))
      : null

  const isComplete =
    totalTarget != null ? totalSaved >= totalTarget : savedThisMonth >= monthlyTarget

  return {
    savedThisMonth,
    totalSaved,
    // Backward-compatible alias for monthly amount shown in older clients.
    saved: savedThisMonth,
    monthlyTarget,
    percentOfMonthly,
    totalTarget,
    percentOfTotal,
    paceEstimate,
    isComplete,
    status: isComplete ? 'complete' : percentOfMonthly >= 80 ? 'on_track' : 'building',
  }
}

export function enrichTracker(tracker, { spentThisMonth = 0, income = 0 } = {}) {
  if (tracker.trackType === 'spending') {
    return {
      ...tracker,
      progress: computeSpendingTrackerProgress(tracker, spentThisMonth),
    }
  }

  return {
    ...tracker,
    progress: computeSavingTrackerProgress(tracker, { income, spent: spentThisMonth }),
  }
}

export function parseTrackType(value) {
  if (typeof value !== 'string' || !TRACK_TYPES.includes(value)) {
    return { error: `trackType must be one of: ${TRACK_TYPES.join(', ')}` }
  }

  return { value }
}

export function parseTrackerName(value, trackType) {
  if (value == null || value === '') {
    return {
      value: trackType === 'spending' ? 'Monthly spending' : 'Savings goal',
    }
  }

  if (typeof value !== 'string') {
    return { error: 'name must be a string' }
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return {
      value: trackType === 'spending' ? 'Monthly spending' : 'Savings goal',
    }
  }

  if (trimmed.length > MAX_TRACKER_NAME_LENGTH) {
    return { error: `name must be at most ${MAX_TRACKER_NAME_LENGTH} characters` }
  }

  return { value: trimmed }
}

export function parsePurposeType(value, trackType) {
  if (trackType === 'spending') {
    return { value: null }
  }

  if (value == null || value === '') {
    return { value: 'future' }
  }

  if (!TRACK_PURPOSE_TYPES.includes(value)) {
    return { error: `purposeType must be one of: ${TRACK_PURPOSE_TYPES.join(', ')}` }
  }

  return { value }
}

export function parseTrackerAmount(value, fieldName, { optional = false } = {}) {
  if (value == null || value === '') {
    return optional ? { value: null } : { error: `${fieldName} is required` }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return { error: `${fieldName} must be a number` }
  }

  if (parsed < MIN_TRACKER_AMOUNT || parsed > MAX_TRACKER_AMOUNT) {
    return { error: `${fieldName} must be between ${MIN_TRACKER_AMOUNT} and ${MAX_TRACKER_AMOUNT}` }
  }

  return { value: roundCurrency(parsed) }
}

export function parseCreateTrackerInput(body) {
  const trackType = parseTrackType(body?.trackType)
  if (trackType.error) {
    return { error: trackType.error }
  }

  const name = parseTrackerName(body?.name, trackType.value)
  if (name.error) {
    return { error: name.error }
  }

  const purposeType = parsePurposeType(body?.purposeType, trackType.value)
  if (purposeType.error) {
    return { error: purposeType.error }
  }

  const monthlyAmount = parseTrackerAmount(body?.monthlyAmount, 'monthlyAmount')
  if (monthlyAmount.error) {
    return { error: monthlyAmount.error }
  }

  const targetTotal = parseTrackerAmount(body?.targetTotal, 'targetTotal', { optional: true })
  if (targetTotal.error) {
    return { error: targetTotal.error }
  }

  if (trackType.value === 'spending' && targetTotal.value != null) {
    return { error: 'targetTotal applies to saving trackers only' }
  }

  const alertThresholds = parseSpendingAlertThresholds(body, { optional: true })
  if (alertThresholds.error) {
    return { error: alertThresholds.error }
  }

  if (trackType.value === 'saving' && alertThresholds.value.hasAny) {
    return { error: 'Alert thresholds apply to spending trackers only' }
  }

  if (
    trackType.value === 'spending' &&
    alertThresholds.value.alertRemainingDollars != null &&
    alertThresholds.value.alertRemainingDollars >= monthlyAmount.value
  ) {
    return {
      error: 'alertRemainingDollars must be less than monthlyAmount (otherwise the warning fires immediately)',
    }
  }

  return {
    value: {
      trackType: trackType.value,
      name: name.value,
      purposeType: purposeType.value,
      monthlyAmount: monthlyAmount.value,
      targetTotal: targetTotal.value,
      ...(trackType.value === 'spending'
        ? {
            alertWarningPercent: alertThresholds.value.alertWarningPercent,
            alertRemainingDollars: alertThresholds.value.alertRemainingDollars,
          }
        : {}),
    },
  }
}

/**
 * Parses optional alert thresholds.
 * Empty string / null clears a field. Omitted fields are left unchanged on update
 * when `forUpdate` is true; on create they default to null (use app default 80%).
 */
export function parseAlertWarningPercent(value, { allowNull = true } = {}) {
  if (value === undefined) {
    return { omitted: true }
  }

  if (value === null || value === '') {
    return allowNull ? { value: null } : { error: 'alertWarningPercent is required' }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { error: 'alertWarningPercent must be a whole number' }
  }

  if (parsed < MIN_ALERT_WARNING_PERCENT || parsed > MAX_ALERT_WARNING_PERCENT) {
    return {
      error: `alertWarningPercent must be between ${MIN_ALERT_WARNING_PERCENT} and ${MAX_ALERT_WARNING_PERCENT}`,
    }
  }

  return { value: parsed }
}

export function parseAlertRemainingDollars(value, { allowNull = true } = {}) {
  if (value === undefined) {
    return { omitted: true }
  }

  if (value === null || value === '') {
    return allowNull ? { value: null } : { error: 'alertRemainingDollars is required' }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return { error: 'alertRemainingDollars must be a number' }
  }

  if (parsed < MIN_TRACKER_AMOUNT || parsed > MAX_TRACKER_AMOUNT) {
    return {
      error: `alertRemainingDollars must be between ${MIN_TRACKER_AMOUNT} and ${MAX_TRACKER_AMOUNT}`,
    }
  }

  return { value: roundCurrency(parsed) }
}

function parseSpendingAlertThresholds(body, { optional = true } = {}) {
  const percent = parseAlertWarningPercent(body?.alertWarningPercent)
  if (percent.error) {
    return { error: percent.error }
  }

  const dollars = parseAlertRemainingDollars(body?.alertRemainingDollars)
  if (dollars.error) {
    return { error: dollars.error }
  }

  const hasAny = !percent.omitted || !dollars.omitted

  if (!optional && !hasAny) {
    return { error: 'At least one alert threshold is required' }
  }

  return {
    value: {
      hasAny,
      alertWarningPercent: percent.omitted ? undefined : percent.value,
      alertRemainingDollars: dollars.omitted ? undefined : dollars.value,
      percentOmitted: Boolean(percent.omitted),
      dollarsOmitted: Boolean(dollars.omitted),
    },
  }
}

export function parseUpdateTrackerInput(body) {
  const updates = {}

  if (body?.name != null) {
    const name = parseTrackerName(body.name, 'saving')
    if (name.error) {
      return { error: name.error }
    }
    updates.name = name.value
  }

  if (body?.purposeType != null) {
    if (!TRACK_PURPOSE_TYPES.includes(body.purposeType)) {
      return { error: `purposeType must be one of: ${TRACK_PURPOSE_TYPES.join(', ')}` }
    }
    updates.purposeType = body.purposeType
  }

  if (body?.monthlyAmount != null) {
    const monthlyAmount = parseTrackerAmount(body.monthlyAmount, 'monthlyAmount')
    if (monthlyAmount.error) {
      return { error: monthlyAmount.error }
    }
    updates.monthlyAmount = monthlyAmount.value
  }

  if (body?.targetTotal !== undefined) {
    const targetTotal = parseTrackerAmount(body.targetTotal, 'targetTotal', { optional: true })
    if (targetTotal.error) {
      return { error: targetTotal.error }
    }
    updates.targetTotal = targetTotal.value
  }

  if (body?.progressAmount != null) {
    const progressAmount = parseLoggedProgressAmount(body.progressAmount, 'progressAmount')
    if (progressAmount.error) {
      return { error: progressAmount.error }
    }
    updates.progressAmount = progressAmount.value
  }

  const alertThresholds = parseSpendingAlertThresholds(body, { optional: true })
  if (alertThresholds.error) {
    return { error: alertThresholds.error }
  }

  if (!alertThresholds.value.percentOmitted) {
    updates.alertWarningPercent = alertThresholds.value.alertWarningPercent
  }
  if (!alertThresholds.value.dollarsOmitted) {
    updates.alertRemainingDollars = alertThresholds.value.alertRemainingDollars
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No valid fields to update' }
  }

  return { value: updates }
}
