/*
 * Contextual starter prompts for Ask Soverm — shown when the thread is empty.
 */

export function buildExpenseAnalyzerSuggestedPrompts({
  totalRecurringMonthly = 0,
} = {}) {
  const prompts = [
    'What stands out most in my spending lately?',
    'Where could I realistically cut back?',
    'How does my spending compare to the prior 30 days?',
  ]

  if (totalRecurringMonthly > 0) {
    prompts.unshift(
      'Are my recurring charges too high for my financial situation?',
      'Walk me through my subscriptions — anything worth canceling?'
    )
  }

  return prompts.slice(0, 4)
}

export function buildDashboardSuggestedPrompts() {
  return [
    'Summarize my financial situation in plain English',
    'What should I focus on first?',
    'Where is most of my money going?',
  ]
}
