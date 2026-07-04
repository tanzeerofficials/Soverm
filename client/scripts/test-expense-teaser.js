/*
 * Verifies dashboard expense analyzer teaser visibility logic.
 *
 * Usage: node scripts/test-expense-teaser.js
 */

const SIGNIFICANT_CATEGORY_CHANGE_PERCENT = 5

function isNotableTopMover(topMover) {
  if (!topMover) {
    return false
  }

  if (topMover.direction === 'flat') {
    return false
  }

  if (topMover.percent == null) {
    return false
  }

  return topMover.percent >= SIGNIFICANT_CATEGORY_CHANGE_PERCENT
}

function shouldShowExpenseTeaser(expenseTeaser) {
  return (
    (expenseTeaser?.recurringCount ?? 0) > 0 || isNotableTopMover(expenseTeaser?.topMover)
  )
}

function formatExpenseTeaserParts(expenseTeaser) {
  const topMover = isNotableTopMover(expenseTeaser?.topMover)
    ? expenseTeaser.topMover
    : null

  return [
    topMover
      ? `${topMover.category} ${topMover.direction} ${topMover.percent}% vs prior 30 days`
      : null,
    (expenseTeaser?.recurringCount ?? 0) > 0
      ? `${expenseTeaser.recurringCount} subscriptions detected`
      : null,
  ].filter(Boolean)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Expense analyzer teaser tests\n')

  assert(!shouldShowExpenseTeaser(undefined), 'Undefined teaser data should stay hidden')
  assert(!shouldShowExpenseTeaser(null), 'Null teaser data should stay hidden')
  assert(!shouldShowExpenseTeaser({ recurringCount: 0, totalRecurringMonthly: 0 }), 'Zero data hidden')
  assert(
    !shouldShowExpenseTeaser({
      recurringCount: 0,
      topMover: { category: 'Uncategorized', direction: 'flat', percent: 0 },
    }),
    'Flat 0% top mover should not show teaser by itself'
  )
  console.log('  pass: teaser hidden for new users / no recurring charges')
  passed++

  assert(
    shouldShowExpenseTeaser({ recurringCount: 3, totalRecurringMonthly: 124.97 }),
    'Shows when recurring count > 0'
  )
  assert(
    shouldShowExpenseTeaser({
      recurringCount: 0,
      topMover: { category: 'Dining', direction: 'up', percent: 32 },
    }),
    'Shows when top mover exists'
  )
  console.log('  pass: teaser visible when recurring charges or top mover exist')
  passed++

  const parts = formatExpenseTeaserParts({
    recurringCount: 3,
    totalRecurringMonthly: 124.97,
    topMover: { category: 'Dining', direction: 'up', percent: 32 },
  })
  assert(parts.length === 2, 'Teaser should include both top mover and subscriptions')
  console.log('  pass: combined teaser parts')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
