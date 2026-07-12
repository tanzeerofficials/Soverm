/*
 * SHARED TRANSACTION FILTERS
 *
 * Cash-flow totals should answer: "How much real money came in / went out?"
 * Not: "How much moved between my own accounts?"
 *
 * Plaid records internal moves twice — e.g. paying a credit card from checking
 * is an outflow on checking and an inflow on the card. Counting both as
 * spend + income makes Income/Spend look huge while Net stays near zero.
 *
 * Use these filters on every income/spend aggregate that users see.
 */

/** Confirmed / posted transactions only — pending amounts can reverse. */
export const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

/**
 * Drop account-to-account transfers from income/spend totals.
 * Category labels like "Transfer" and merchant names containing the word
 * "transfer" (word boundary so unrelated names stay).
 */
export const EXCLUDE_TRANSFER_FILTER = `
  AND COALESCE(t.category, '') !~* 'transfer'
  AND COALESCE(t.name, '') !~* '\\btransfer\\b'
`

/**
 * Drop credit-card / loan / bill payments that are not discretionary spend
 * and are not true income when they appear as negative amounts on the
 * liability account.
 */
export const EXCLUDE_PAYMENT_FILTER = `
  AND COALESCE(t.category, '') !~* 'payment'
  AND COALESCE(t.name, '') !~* '\\b(credit card|card payment|autopay|auto pay)\\b'
`

/** Combined filter for trustworthy cash-flow income and spend. */
export const EXCLUDE_INTERNAL_MOVES_FILTER = `
  ${EXCLUDE_TRANSFER_FILTER}
  ${EXCLUDE_PAYMENT_FILTER}
`

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * True when a transaction is an internal move (transfer or liability payment),
 * not real income or discretionary spending.
 */
export function isInternalMoveTransaction(row) {
  if (!row) {
    return true
  }

  const category = normalizeText(row.category)
  const name = normalizeText(row.name)

  if (category.includes('transfer') || category.includes('payment')) {
    return true
  }

  if (/\btransfer\b/.test(name)) {
    return true
  }

  if (/\b(credit card|card payment|autopay|auto pay)\b/.test(name)) {
    return true
  }

  return false
}

/** Posted outflow that should count toward spending totals. */
export function isCashFlowSpendingRow(row) {
  const amount = Number(row?.amount)
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    Boolean(row?.date) &&
    row.pending !== true &&
    !isInternalMoveTransaction(row)
  )
}

/** Posted inflow that should count toward income totals. */
export function isCashFlowIncomeRow(row) {
  const amount = Number(row?.amount)
  return (
    Number.isFinite(amount) &&
    amount < 0 &&
    Boolean(row?.date) &&
    row.pending !== true &&
    !isInternalMoveTransaction(row)
  )
}
