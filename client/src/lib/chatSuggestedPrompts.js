/*
 * Contextual starter prompts for Ask Soverm — shown when the thread is empty.
 */

export function buildExpenseAnalyzerSuggestedPrompts({
  totalRecurringMonthly = 0,
} = {}) {
  const prompts = [
    'What stands out most in my spending lately?',
    'Where could I realistically cut back?',
    'How can I maximize my savings from these expenses?',
  ]

  if (totalRecurringMonthly > 0) {
    prompts.unshift(
      'Are my recurring charges too high for my financial situation?',
      'Walk me through my subscriptions — anything worth canceling?'
    )
  }

  return prompts.slice(0, 4)
}

export function buildEverydayMoneySuggestedPrompts() {
  return [
    'How do I file my taxes online — walk me through it?',
    'Plan a night out with friends on what I can actually spend',
    'How can I maximize my savings with what I’m spending now?',
    'What’s the simplest way to start an emergency fund?',
  ]
}

export function buildDashboardSuggestedPrompts() {
  const everyday = buildEverydayMoneySuggestedPrompts()
  return [
    'Will I make it to payday at this week’s pace?',
    'What’s left after known bills, and what’s my one move?',
    everyday[1],
    everyday[2],
  ]
}

export function buildWeeklyReviewSuggestedPrompts() {
  return [
    'Will I make it to payday at this week’s pace?',
    'What’s my one better money move this week?',
    'Which bill or subscription should I tackle first?',
    'How tight is my runway until payday?',
  ]
}

export function buildMonthLetterSuggestedPrompts() {
  return [
    'Summarize my financial condition this month in plain English',
    'What’s driving my spending this month?',
    'What should I change next month?',
    'Any subscriptions that look expensive for my situation?',
  ]
}

/** Route-aware defaults when opening Ask Soverm from the FAB. */
export function resolveAskSovermPageContext(pathname = '') {
  if (pathname.startsWith('/weekly-review')) {
    return {
      suggestedPrompts: buildWeeklyReviewSuggestedPrompts(),
      contextLabel:
        'Your ongoing Ask Soverm chat — using this week’s review, what’s left until payday, and your connected accounts.',
    }
  }

  if (pathname.startsWith('/month-condition')) {
    return {
      suggestedPrompts: buildMonthLetterSuggestedPrompts(),
      contextLabel:
        'Your ongoing Ask Soverm chat — using this month’s condition letter and your connected accounts.',
    }
  }

  if (pathname.startsWith('/expense-analyzer')) {
    return {
      suggestedPrompts: buildExpenseAnalyzerSuggestedPrompts(),
      contextLabel:
        'Your ongoing Ask Soverm chat — using Expense Analyzer categories, recurring charges, and your connected accounts.',
    }
  }

  return {
    suggestedPrompts: buildDashboardSuggestedPrompts(),
    contextLabel:
      'Your ongoing Ask Soverm chat — using your accounts, spending, and what’s left when available.',
  }
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
