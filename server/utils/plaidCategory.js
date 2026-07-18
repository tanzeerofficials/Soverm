/*
 * PLAID CATEGORY RESOLUTION
 *
 * Maps Plaid personal_finance_category (and legacy category arrays) into the
 * string we store on transactions.category.
 *
 * We prefer specific labels over Plaid's vague TRANSFER_* buckets:
 * - Peer rails (Zelle, Venmo, …) → Peer transfer
 * - ATM / check / mobile deposits → Self deposit
 * - ATM cash withdrawals → Cash out
 * - Own-account moves → Self transfer
 */

import {
  isCashOutTransaction,
  isDepositTransaction,
  isPayrollIncomeTransaction,
  isPeerPaymentTransaction,
} from './cashFlowClassification.js'

/** @deprecated Prefer PEER_TRANSFER_CATEGORY_LABEL for peer rails. */
export const TRANSFER_CATEGORY_LABEL = 'Peer transfer'

export const PEER_TRANSFER_CATEGORY_LABEL = 'Peer transfer'
export const SELF_DEPOSIT_CATEGORY_LABEL = 'Self deposit'
export const SELF_TRANSFER_CATEGORY_LABEL = 'Self transfer'
export const CASH_OUT_CATEGORY_LABEL = 'Cash out'
/** Plaid MEDICAL + legacy Healthcare / Health → one spending bucket. */
export const HEALTHCARE_CATEGORY_LABEL = 'Healthcare'

const SPENDING_CATEGORY_ALIASES = {
  medical: HEALTHCARE_CATEGORY_LABEL,
  healthcare: HEALTHCARE_CATEGORY_LABEL,
  health: HEALTHCARE_CATEGORY_LABEL,
}

/*
 * What this does: collapses known duplicate category labels into one canonical name.
 * Why: Plaid PFC "Medical" and legacy "Healthcare" are the same life category.
 */
export function canonicalizeSpendingCategoryLabel(category) {
  const trimmed = String(category ?? '').trim()
  if (!trimmed) {
    return 'Uncategorized'
  }
  const alias = SPENDING_CATEGORY_ALIASES[trimmed.toLowerCase()]
  return alias ?? trimmed
}

function formatPersonalFinanceCategoryPrimary(primary) {
  return primary
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

function isTransferPrimary(primary) {
  return String(primary || '')
    .trim()
    .toUpperCase()
    .startsWith('TRANSFER')
}

/*
 * What this does: picks the category string to store for a Plaid transaction.
 * Why: vague Transfer labels confuse users — we store the specific kind instead.
 */
export function resolvePlaidTransactionCategory(transaction) {
  const name =
    transaction?.name ||
    transaction?.merchant_name ||
    transaction?.original_description ||
    ''
  const amount = Number(transaction?.amount)
  const row = { name, amount, category: null }

  if (isPeerPaymentTransaction(row)) {
    return PEER_TRANSFER_CATEGORY_LABEL
  }

  if (isPayrollIncomeTransaction(row) && Number.isFinite(amount) && amount < 0) {
    const primary = transaction?.personal_finance_category?.primary
    if (primary && !isTransferPrimary(primary)) {
      return formatPersonalFinanceCategoryPrimary(primary)
    }
    return 'Income'
  }

  if (isDepositTransaction(row) && Number.isFinite(amount) && amount < 0) {
    return SELF_DEPOSIT_CATEGORY_LABEL
  }

  if (isCashOutTransaction(row) && Number.isFinite(amount) && amount > 0) {
    return CASH_OUT_CATEGORY_LABEL
  }

  const primary = transaction?.personal_finance_category?.primary

  if (primary) {
    if (isTransferPrimary(primary)) {
      return SELF_TRANSFER_CATEGORY_LABEL
    }
    return formatPersonalFinanceCategoryPrimary(primary)
  }

  if (Array.isArray(transaction?.category) && transaction.category.length > 0) {
    const legacy = transaction.category[0]
    if (typeof legacy === 'string' && legacy.toLowerCase().includes('transfer')) {
      return SELF_TRANSFER_CATEGORY_LABEL
    }
    if (typeof legacy === 'string' && legacy.toLowerCase() === 'atm') {
      return amount > 0 ? CASH_OUT_CATEGORY_LABEL : SELF_DEPOSIT_CATEGORY_LABEL
    }
    return legacy
  }

  return null
}
/*
 * What this does: category bucket for Expense Analyzer / month letter / charts.
 * Why: already-synced rows may still say "Transfer" or "Personal Care" until
 * corrected — read-time resolve keeps surfaces specific and consistent.
 */
export function resolveSpendingCategoryLabel(row) {
  if (isPeerPaymentTransaction(row)) {
    return PEER_TRANSFER_CATEGORY_LABEL
  }

  const amount = Number(row?.amount)
  if (isPayrollIncomeTransaction(row) && Number.isFinite(amount) && amount < 0) {
    const category = typeof row?.category === 'string' ? row.category.trim() : ''
    const lower = category.toLowerCase()
    if (
      category &&
      lower !== 'self deposit' &&
      lower !== 'self transfer' &&
      lower !== 'transfer' &&
      !lower.includes('transfer')
    ) {
      return category
    }
    return 'Income'
  }
  if (isDepositTransaction(row) && Number.isFinite(amount) && amount < 0) {
    return SELF_DEPOSIT_CATEGORY_LABEL
  }
  if (isCashOutTransaction(row) && Number.isFinite(amount) && amount > 0) {
    return CASH_OUT_CATEGORY_LABEL
  }

  const category = typeof row?.category === 'string' ? row.category.trim() : ''
  if (!category) {
    return 'Uncategorized'
  }

  const lower = category.toLowerCase()
  if (
    lower === 'self deposit' ||
    lower === 'self transfer' ||
    lower === 'cash out' ||
    lower === 'peer transfer'
  ) {
    return category
  }

  // Legacy "Transfer" / "Transfer In" / "Transfer Out" → Self transfer
  // (peer rails already handled above).
  if (lower.includes('transfer')) {
    return SELF_TRANSFER_CATEGORY_LABEL
  }

  if (lower === 'atm' || lower.includes('atm')) {
    return amount > 0
      ? CASH_OUT_CATEGORY_LABEL
      : canonicalizeSpendingCategoryLabel(category)
  }

  return canonicalizeSpendingCategoryLabel(category)
}
