/*
 * PLAID CATEGORY RESOLUTION
 *
 * Maps Plaid personal_finance_category (and legacy category arrays) into the
 * string we store on transactions.category.
 *
 * Peer rails (Zelle, Venmo, etc.) often arrive mislabeled by Plaid — e.g.
 * PERSONAL_CARE for a person-to-person send. We override those to Transfer
 * so spending charts and category soft limits stay honest.
 */

import { isPeerPaymentTransaction } from './cashFlowClassification.js'

/** Stored label for peer rails and Plaid TRANSFER_* primaries. */
export const TRANSFER_CATEGORY_LABEL = 'Transfer'

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
 * Why: peer payments must not inherit Plaid mislabels like Personal Care.
 */
export function resolvePlaidTransactionCategory(transaction) {
  const name =
    transaction?.name ||
    transaction?.merchant_name ||
    transaction?.original_description ||
    ''

  if (isPeerPaymentTransaction({ name })) {
    return TRANSFER_CATEGORY_LABEL
  }

  const primary = transaction?.personal_finance_category?.primary

  if (primary) {
    if (isTransferPrimary(primary)) {
      return TRANSFER_CATEGORY_LABEL
    }
    return formatPersonalFinanceCategoryPrimary(primary)
  }

  if (Array.isArray(transaction?.category) && transaction.category.length > 0) {
    const legacy = transaction.category[0]
    if (typeof legacy === 'string' && legacy.toLowerCase().includes('transfer')) {
      return TRANSFER_CATEGORY_LABEL
    }
    return legacy
  }

  return null
}

/*
 * What this does: category bucket for Expense Analyzer / month letter / charts.
 * Why: already-synced Zelle rows may still say "Personal Care" or "Transfer Out"
 * until corrected — read-time resolve keeps surfaces consistent.
 */
export function resolveSpendingCategoryLabel(row) {
  if (isPeerPaymentTransaction(row)) {
    return TRANSFER_CATEGORY_LABEL
  }

  const category = typeof row?.category === 'string' ? row.category.trim() : ''
  if (!category) {
    return 'Uncategorized'
  }

  // Normalize leftover Plaid labels like "Transfer Out" / "Transfer In".
  if (category.toLowerCase().includes('transfer')) {
    return TRANSFER_CATEGORY_LABEL
  }

  return category
}
