export const GOAL_PURPOSE_OPTIONS = [
  { value: 'debt', label: 'Pay off debt', hint: 'Money you plan to put toward debt this month' },
  { value: 'purchase', label: 'Save for a purchase', hint: 'Saving toward something specific' },
  { value: 'future', label: 'Future / emergency', hint: 'Setting aside for later' },
]

export function goalPurposeLabel(purposeType) {
  return GOAL_PURPOSE_OPTIONS.find((option) => option.value === purposeType)?.label ?? 'Savings goal'
}

export function goalPurposeHint(purposeType) {
  return GOAL_PURPOSE_OPTIONS.find((option) => option.value === purposeType)?.hint ?? ''
}
