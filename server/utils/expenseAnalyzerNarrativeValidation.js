function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

function collectAllowedAmounts(brief) {
  const amounts = new Set()
  const add = (value) => {
    const rounded = roundCurrency(value)
    if (Number.isFinite(rounded)) {
      amounts.add(rounded)
    }
  }

  add(brief.overallSpending.currentTotal)
  add(brief.overallSpending.priorTotal)
  add(brief.overallSpending.confirmedRecurringMonthly)
  add(brief.overallSpending.oneTimeTotal)

  if (brief.topMover) {
    add(brief.topMover.currentTotal)
    add(brief.topMover.recurringMonthly)
    add(brief.topMover.oneTimeTotal)
    if (brief.topMover.percent != null) {
      amounts.add(roundCurrency(brief.topMover.percent))
    }
  }

  if (brief.overallSpending.delta?.percent != null) {
    amounts.add(roundCurrency(brief.overallSpending.delta.percent))
  }

  for (const charge of brief.confirmedRecurring) {
    add(charge.monthlyEquivalent)
  }

  for (const charge of brief.reviewItems) {
    add(charge.monthlyEquivalent)
  }

  for (const category of brief.topCategories) {
    add(category.currentTotal)
    add(category.recurringMonthly)
    add(category.oneTimeTotal)
    if (category.delta?.percent != null) {
      amounts.add(roundCurrency(category.delta.percent))
    }
  }

  return amounts
}

function parseDollarAmount(raw) {
  const normalized = raw.replace(/[$,]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? roundCurrency(value) : null
}

export function extractDollarAmounts(text) {
  const amounts = []
  const pattern = /\$[\d,]+(?:\.\d{2})?/g

  for (const match of text.matchAll(pattern)) {
    const parsed = parseDollarAmount(match[0])
    if (parsed != null) {
      amounts.push(parsed)
    }
  }

  return amounts
}

function isAllowedAmount(amount, allowedAmounts) {
  if (allowedAmounts.has(amount)) {
    return true
  }

  for (const allowed of allowedAmounts) {
    if (Math.abs(allowed - amount) <= 0.02) {
      return true
    }
  }

  return false
}

export function validatePersonalNarrative({ paragraphs, lead, brief }) {
  if (!Array.isArray(paragraphs) || paragraphs.length < 2 || paragraphs.length > 3) {
    return { valid: false, reason: 'Expected 2-3 paragraphs' }
  }

  if (paragraphs.some((paragraph) => typeof paragraph !== 'string' || !paragraph.trim())) {
    return { valid: false, reason: 'Paragraphs must be non-empty strings' }
  }

  const combined = [lead, ...paragraphs].filter(Boolean).join('\n')
  const allowedAmounts = collectAllowedAmounts(brief)

  for (const amount of extractDollarAmounts(combined)) {
    if (!isAllowedAmount(amount, allowedAmounts)) {
      return { valid: false, reason: `Unapproved dollar amount $${amount}` }
    }
  }

  const lower = combined.toLowerCase()

  if (brief.rules.reviewCount === 0 && lower.includes('review')) {
    return { valid: false, reason: 'Mentioned Review when none exist' }
  }

  if (brief.rules.confirmedRecurringCount === 0 && /subscription|recurring charge/.test(lower)) {
    return { valid: false, reason: 'Mentioned subscriptions when none are confirmed' }
  }

  if (
    brief.rules.reviewCount > 0 &&
    !/(review|not counted|not included|uncertain|might be|too early)/i.test(combined)
  ) {
    return {
      valid: false,
      reason: 'Review items exist but narrative did not acknowledge uncertainty',
    }
  }

  return { valid: true }
}

export { collectAllowedAmounts }
