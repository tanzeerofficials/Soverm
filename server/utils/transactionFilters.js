/*
 * SHARED TRANSACTION FILTERS
 *
 * Thin re-exports around cashFlowClassification so existing imports keep working.
 * New code should prefer classifyCashFlowTransaction / summarizeCashFlow.
 */

/** Confirmed / posted transactions only — pending amounts can reverse. */
export const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'

export {
  PEER_PAYMENT_NAME_PATTERN,
  EXCLUDE_INTERNAL_MOVES_FILTER,
  isPeerPaymentTransaction,
  isInternalMoveTransaction,
  isCashFlowSpendingRow,
  isCashFlowIncomeRow,
  buildRecentCashFlowActivity,
  classifyCashFlowTransaction,
  summarizeCashFlow,
  resolveCashFlowBadge,
  CASH_FLOW_KINDS,
  KIND_LABELS,
  KIND_BADGES,
} from './cashFlowClassification.js'

import { PEER_PAYMENT_NAME_PATTERN } from './cashFlowClassification.js'

/** @deprecated Prefer EXCLUDE_INTERNAL_MOVES_FILTER. */
export const EXCLUDE_TRANSFER_FILTER = `
  AND (
    COALESCE(t.name, '') ~* '${PEER_PAYMENT_NAME_PATTERN}'
    OR (
      COALESCE(t.category, '') !~* 'transfer'
      AND COALESCE(t.name, '') !~* '\\btransfer\\b'
    )
  )
`

/** @deprecated Prefer EXCLUDE_INTERNAL_MOVES_FILTER. */
export const EXCLUDE_PAYMENT_FILTER = `
  AND (
    COALESCE(t.name, '') ~* '${PEER_PAYMENT_NAME_PATTERN}'
    OR (
      COALESCE(t.category, '') !~* 'payment'
      AND COALESCE(t.name, '') !~* '\\b(credit card|card payment|autopay|auto pay)\\b'
    )
  )
`
