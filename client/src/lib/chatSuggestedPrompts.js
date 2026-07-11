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
    'Will I make it to payday at this week’s pace?',
    'What’s left after known bills, and what’s my one move?',
    'Summarize my financial situation in plain English',
    'Can I afford a $40 purchase before payday?',
  ]
}

/*
 * What this does: builds a starter question about one recurring charge.
 * Why: Expense Analyzer RECURRING tab can jump straight into Ask Soverm
 * with the merchant already named so review feels one-click.
 */
export function buildRecurringReviewPrompt(charge) {
  const merchant = charge?.merchant?.trim() || 'this subscription'
  const monthly = charge?.monthlyEquivalent ?? charge?.averageAmount
  const amountHint =
    typeof monthly === 'number' && Number.isFinite(monthly)
      ? ` (about $${monthly.toFixed(2)}/mo)`
      : ''

  return `Help me review ${merchant}${amountHint} — is it worth keeping, and what would cancelling change for my budget?`
}

/*
 * Keep / cancel / watch decision for bill defense findings.
 */
export function buildCancelKeepWatchPrompt(findingOrCharge) {
  const merchant =
    findingOrCharge?.merchant?.trim() ||
    findingOrCharge?.charge?.merchant?.trim() ||
    'this subscription'
  const monthly =
    findingOrCharge?.monthlyEquivalent ??
    findingOrCharge?.lastAmount ??
    findingOrCharge?.averageAmount
  const amountHint =
    typeof monthly === 'number' && Number.isFinite(monthly)
      ? ` (about $${Number(monthly).toFixed(2)}/mo)`
      : ''
  const reason = findingOrCharge?.detail ? ` Context: ${findingOrCharge.detail}` : ''

  return `Help me decide on ${merchant}${amountHint}: should I keep it, cancel it, or watch one more cycle? Give a clear recommendation for someone living paycheck to paycheck.${reason}`
}

export function buildRecurringPortfolioPrompt() {
  return 'Walk me through my subscriptions — which ones are worth keeping vs canceling?'
}
