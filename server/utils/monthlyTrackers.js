/*
 * MONTHLY TRACKER HELPERS
 *
 * Unified spending cap + savings goal tracking for the calendar month.
 * Spending and saving trackers are independent — saving does not reduce
 * the spending cap automatically.
 */

import { roundCurrency } from './safeToSpend.js'

export const TRACK_TYPES = ['spending', 'saving']
export const TRACK_PURPOSE_TYPES = ['debt', 'purchase', 'future']
export const MAX_SAVING_TRACKERS = 5
export const MAX_TRACKER_NAME_LENGTH = 80
export const MIN_TRACKER_AMOUNT = 1
export const MAX_TRACKER_AMOUNT = 999_999.99

export function mapTrackerRow(row) {
  const monthlyAmount = roundCurrency(row.monthly_amount)
  const targetTotal = row.target_total != null ? roundCurrency(row.target_total) : null
  const progressAmount = roundCurrency(row.progress_amount)

  return {
    id: row.id,
    trackType: row.track_type,
    name: row.name || (row.track_type === 'spending' ? 'Monthly spending' : 'Savings goal'),
    purposeType: row.purpose_type,
    monthlyAmount,
    targetTotal,
    progressAmount,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function computeSpendingTrackerProgress(tracker, spentThisMonth = 0) {
  const limit = roundCurrency(tracker.monthlyAmount)
  const spent = roundCurrency(spentThisMonth)
  const remaining = roundCurrency(limit - spent)
  const percentUsed = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const isOver = spent > limit

  return {
    spent,
    remaining,
    percentUsed,
    isOver,
    overBy: isOver ? roundCurrency(spent - limit) : 0,
    status: isOver ? 'over' : percentUsed >= 80 ? 'warning' : 'on_track',
  }
}

export function computeSavingTrackerProgress(tracker, { income = 0, spent = 0 } = {}) {
  const monthlyTarget = roundCurrency(tracker.monthlyAmount)
  const saved = roundCurrency(tracker.progressAmount ?? 0)
  const paceEstimate = roundCurrency(Math.max(0, income - spent))
  const percentOfMonthly =
    monthlyTarget > 0 ? Math.min(100, Math.round((saved / monthlyTarget) * 100)) : 0
  const totalTarget = tracker.targetTotal
  const percentOfTotal =
    totalTarget != null && totalTarget > 0
      ? Math.min(100, Math.round((saved / totalTarget) * 100))
      : null

  const isComplete = totalTarget != null ? saved >= totalTarget : saved >= monthlyTarget

  return {
    saved,
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

  return {
    value: {
      trackType: trackType.value,
      name: name.value,
      purposeType: purposeType.value,
      monthlyAmount: monthlyAmount.value,
      targetTotal: targetTotal.value,
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
    const progressAmount = parseTrackerAmount(body.progressAmount, 'progressAmount')
    if (progressAmount.error) {
      return { error: progressAmount.error }
    }
    updates.progressAmount = progressAmount.value
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No valid fields to update' }
  }

  return { value: updates }
}
