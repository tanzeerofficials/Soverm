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

