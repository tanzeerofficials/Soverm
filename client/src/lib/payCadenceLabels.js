/*
 * Shared human labels for pay cadence (never show raw enums like "biweekly").
 */

const CADENCE_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
}

export function formatPayCadence(cadence) {
  if (!cadence) {
    return null
  }
  return CADENCE_LABELS[cadence] ?? String(cadence)
}

export const PAY_CADENCE_OPTIONS = [
  { value: 'weekly', label: CADENCE_LABELS.weekly },
  { value: 'biweekly', label: CADENCE_LABELS.biweekly },
  { value: 'semimonthly', label: CADENCE_LABELS.semimonthly },
  { value: 'monthly', label: CADENCE_LABELS.monthly },
]

export function formatActionStatus(status) {
  switch (status) {
    case 'accepted':
      return 'In progress'
    case 'done':
      return 'Done'
    case 'skipped':
      return 'Skipped'
    case 'dismissed':
      return 'Dismissed'
    case 'suggested':
      return 'Suggested'
    default:
      return status ? String(status) : '—'
  }
}
