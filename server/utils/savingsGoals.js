/*
 * SAVINGS GOALS HELPERS
 *
 * Validation and serialization for plan-based monthly savings goals.
 */

import { roundCurrency } from './safeToSpend.js'

export const GOAL_PURPOSE_TYPES = ['debt', 'purchase', 'future']
export const MAX_ACTIVE_SAVINGS_GOALS = 5
export const MAX_GOAL_NAME_LENGTH = 80
export const MIN_GOAL_AMOUNT = 1
export const MAX_GOAL_AMOUNT = 999_999.99

export function sumPlannedGoalsMonthly(goals = []) {
  const total = goals
    .filter((goal) => goal.active !== false)
    .reduce((sum, goal) => sum + Number(goal.monthly_amount ?? goal.monthlyAmount ?? 0), 0)

  return roundCurrency(total)
}

export function mapSavingsGoalRow(row) {
  const monthlyAmount = roundCurrency(row.monthly_amount)
  const targetTotal =
    row.target_total != null ? roundCurrency(row.target_total) : null
  const savedSoFar = roundCurrency(row.saved_so_far)

  return {
    id: row.id,
    name: row.name,
    purposeType: row.purpose_type,
    monthlyAmount,
    targetTotal,
    savedSoFar,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressPercent:
      targetTotal != null && targetTotal > 0
        ? Math.min(100, Math.round((savedSoFar / targetTotal) * 100))
        : null,
    isComplete: targetTotal != null && savedSoFar >= targetTotal,
  }
}

export function parseGoalPurposeType(value) {
  if (typeof value !== 'string' || !GOAL_PURPOSE_TYPES.includes(value)) {
    return { error: `purposeType must be one of: ${GOAL_PURPOSE_TYPES.join(', ')}` }
  }

  return { value }
}

export function parseGoalName(value) {
  if (typeof value !== 'string') {
    return { error: 'name is required' }
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return { error: 'name is required' }
  }

  if (trimmed.length > MAX_GOAL_NAME_LENGTH) {
    return { error: `name must be at most ${MAX_GOAL_NAME_LENGTH} characters` }
  }

  return { value: trimmed }
}

export function parseGoalAmount(value, fieldName) {
  if (value == null || value === '') {
    return fieldName === 'targetTotal' ? { value: null } : { error: `${fieldName} is required` }
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return { error: `${fieldName} must be a number` }
  }

  if (parsed < MIN_GOAL_AMOUNT || parsed > MAX_GOAL_AMOUNT) {
    return { error: `${fieldName} must be between ${MIN_GOAL_AMOUNT} and ${MAX_GOAL_AMOUNT}` }
  }

  return { value: roundCurrency(parsed) }
}

export function parseCreateGoalInput(body) {
  const name = parseGoalName(body?.name)
  if (name.error) {
    return { error: name.error }
  }

  const purposeType = parseGoalPurposeType(body?.purposeType ?? 'future')
  if (purposeType.error) {
    return { error: purposeType.error }
  }

  const monthlyAmount = parseGoalAmount(body?.monthlyAmount, 'monthlyAmount')
  if (monthlyAmount.error) {
    return { error: monthlyAmount.error }
  }

  const targetTotal = parseGoalAmount(body?.targetTotal, 'targetTotal')
  if (targetTotal.error) {
    return { error: targetTotal.error }
  }

  return {
    value: {
      name: name.value,
      purposeType: purposeType.value,
      monthlyAmount: monthlyAmount.value,
      targetTotal: targetTotal.value,
    },
  }
}

export function parseUpdateGoalInput(body) {
  const updates = {}

  if (body?.name != null) {
    const name = parseGoalName(body.name)
    if (name.error) {
      return { error: name.error }
    }
    updates.name = name.value
  }

  if (body?.purposeType != null) {
    const purposeType = parseGoalPurposeType(body.purposeType)
    if (purposeType.error) {
      return { error: purposeType.error }
    }
    updates.purposeType = purposeType.value
  }

  if (body?.monthlyAmount != null) {
    const monthlyAmount = parseGoalAmount(body.monthlyAmount, 'monthlyAmount')
    if (monthlyAmount.error) {
      return { error: monthlyAmount.error }
    }
    updates.monthlyAmount = monthlyAmount.value
  }

  if (body?.targetTotal !== undefined) {
    const targetTotal = parseGoalAmount(body.targetTotal, 'targetTotal')
    if (targetTotal.error) {
      return { error: targetTotal.error }
    }
    updates.targetTotal = targetTotal.value
  }

  if (body?.savedSoFar != null) {
    const savedSoFar = parseGoalAmount(body.savedSoFar, 'savedSoFar')
    if (savedSoFar.error) {
      return { error: savedSoFar.error }
    }
    updates.savedSoFar = savedSoFar.value
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No valid fields to update' }
  }

  return { value: updates }
}
