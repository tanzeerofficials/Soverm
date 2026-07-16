/*
 * CASH FLOW CLASSIFICATION
 *
 * Every posted connected-account transaction gets exactly one kind.
 * Headline Money in / Money out only count external cash. Own-account
 * transfers and credit-card/loan payments are tracked separately so
 * users can see everything without double-counting.
 */

export const CASH_FLOW_KINDS = {
  INCOME: 'income',
  PEER_IN: 'peer_in',
  SPEND: 'spend',
  PEER_OUT: 'peer_out',
  INTERNAL_TRANSFER: 'internal_transfer',
  LIABILITY_PAYMENT: 'liability_payment',
}

export const MONEY_IN_KINDS = new Set([CASH_FLOW_KINDS.INCOME, CASH_FLOW_KINDS.PEER_IN])
export const MONEY_OUT_KINDS = new Set([CASH_FLOW_KINDS.SPEND, CASH_FLOW_KINDS.PEER_OUT])

/** Peer rails — money exchanged with another person. */
export const PEER_PAYMENT_NAME_PATTERN =
  '\\b(zelle|venmo|cash ?app|cashapp|paypal|taptap|tap tap|wise|remitly|western union|apple cash|google pay)\\b'

const PEER_PAYMENT_REGEX = new RegExp(PEER_PAYMENT_NAME_PATTERN, 'i')
const LIABILITY_NAME_REGEX = /\b(credit card|card payment|autopay|auto pay)\b/i
const TRANSFER_NAME_REGEX = /\btransfer\b/i

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100
}

export function isPeerPaymentTransaction(row) {
  if (!row) {
    return false
  }
  return PEER_PAYMENT_REGEX.test(normalizeText(row.name))
}

function isLiabilityPaymentTransaction(row) {
  if (isPeerPaymentTransaction(row)) {
    return false
  }

  const category = normalizeText(row?.category)
  const name = normalizeText(row?.name)

  if (category.includes('payment')) {
    return true
  }

  return LIABILITY_NAME_REGEX.test(name)
}

function isOwnAccountTransferTransaction(row) {
  if (isPeerPaymentTransaction(row) || isLiabilityPaymentTransaction(row)) {
    return false
  }

  const category = normalizeText(row?.category)
  const name = normalizeText(row?.name)

  return category.includes('transfer') || TRANSFER_NAME_REGEX.test(name)
}

/**
 * Classify one transaction into a single cash-flow kind.
 * Pending rows return null (excluded from ledger totals).
 */
export function classifyCashFlowTransaction(row) {
  if (!row || row.pending === true) {
    return null
  }

  const amount = Number(row.amount)
  if (!Number.isFinite(amount) || amount === 0 || !row.date) {
    return null
  }

  if (isPeerPaymentTransaction(row)) {
    return amount < 0 ? CASH_FLOW_KINDS.PEER_IN : CASH_FLOW_KINDS.PEER_OUT
  }

  if (isLiabilityPaymentTransaction(row)) {
    return CASH_FLOW_KINDS.LIABILITY_PAYMENT
  }

  if (isOwnAccountTransferTransaction(row)) {
    return CASH_FLOW_KINDS.INTERNAL_TRANSFER
  }

  return amount < 0 ? CASH_FLOW_KINDS.INCOME : CASH_FLOW_KINDS.SPEND
}

export function isInternalMoveTransaction(row) {
  if (!row || row.pending === true) {
    return false
  }

  // Date is required by classifyCashFlowTransaction for ledger rows; helpers
  // sometimes check category/name alone, so supply a placeholder date.
  const kind = classifyCashFlowTransaction({
    ...row,
    date: row.date || '1970-01-01',
  })

  return (
    kind === CASH_FLOW_KINDS.INTERNAL_TRANSFER ||
    kind === CASH_FLOW_KINDS.LIABILITY_PAYMENT
  )
}

export function isCashFlowSpendingRow(row) {
  const kind = classifyCashFlowTransaction(row)
  return MONEY_OUT_KINDS.has(kind)
}

export function isCashFlowIncomeRow(row) {
  const kind = classifyCashFlowTransaction(row)
  return MONEY_IN_KINDS.has(kind)
}

export const KIND_LABELS = {
  [CASH_FLOW_KINDS.INCOME]: 'Income',
  [CASH_FLOW_KINDS.PEER_IN]: 'Peer received',
  [CASH_FLOW_KINDS.SPEND]: 'Spending',
  [CASH_FLOW_KINDS.PEER_OUT]: 'Peer sent',
  [CASH_FLOW_KINDS.INTERNAL_TRANSFER]: 'Between accounts',
  [CASH_FLOW_KINDS.LIABILITY_PAYMENT]: 'Card/loan payment',
}

export const KIND_BADGES = {
  [CASH_FLOW_KINDS.INCOME]: 'Received',
  [CASH_FLOW_KINDS.PEER_IN]: 'Peer in',
  [CASH_FLOW_KINDS.SPEND]: 'Spent',
  [CASH_FLOW_KINDS.PEER_OUT]: 'Peer out',
  [CASH_FLOW_KINDS.INTERNAL_TRANSFER]: 'Between accounts',
  [CASH_FLOW_KINDS.LIABILITY_PAYMENT]: 'Card payment',
}

/** Prefer rail-specific badges (Zelle in/out) when the name names the rail. */
export function resolveCashFlowBadge(kind, name = '') {
  const base = KIND_BADGES[kind] ?? KIND_LABELS[kind] ?? 'Activity'
  if (kind !== CASH_FLOW_KINDS.PEER_IN && kind !== CASH_FLOW_KINDS.PEER_OUT) {
    return base
  }

  const text = normalizeText(name)
  const direction = kind === CASH_FLOW_KINDS.PEER_IN ? 'in' : 'out'
  const rails = [
    ['zelle', 'Zelle'],
    ['venmo', 'Venmo'],
    ['cash app', 'Cash App'],
    ['cashapp', 'Cash App'],
    ['paypal', 'PayPal'],
    ['apple cash', 'Apple Cash'],
  ]

  for (const [needle, label] of rails) {
    if (text.includes(needle)) {
      return `${label} ${direction}`
    }
  }

  return base
}

function emptyByKind() {
  return {
    [CASH_FLOW_KINDS.INCOME]: 0,
    [CASH_FLOW_KINDS.PEER_IN]: 0,
    [CASH_FLOW_KINDS.SPEND]: 0,
    [CASH_FLOW_KINDS.PEER_OUT]: 0,
    [CASH_FLOW_KINDS.INTERNAL_TRANSFER]: 0,
    [CASH_FLOW_KINDS.LIABILITY_PAYMENT]: 0,
  }
}

/**
 * Summarize posted transactions into headline money in/out plus full ledger.
 */
export function summarizeCashFlow(transactions = [], { activityLimit = 24 } = {}) {
  const byKind = emptyByKind()
  const activity = []

  for (const row of transactions) {
    const kind = classifyCashFlowTransaction(row)
    if (!kind) {
      continue
    }

    const absolute = roundMoney(Math.abs(Number(row.amount)))
    byKind[kind] = roundMoney(byKind[kind] + absolute)

    const isInflow = Number(row.amount) < 0
    const isExternalIn = MONEY_IN_KINDS.has(kind)
    const isExternalOut = MONEY_OUT_KINDS.has(kind)

    activity.push({
      name: row.name,
      date: row.date,
      category:
        kind === CASH_FLOW_KINDS.PEER_IN || kind === CASH_FLOW_KINDS.PEER_OUT
          ? 'Transfer'
          : row.category || KIND_LABELS[kind],
      amount: absolute,
      kind,
      kindLabel: KIND_LABELS[kind],
      badge: resolveCashFlowBadge(kind, row.name),
      direction: isInflow ? 'in' : 'out',
      countsTowardMoneyIn: isExternalIn,
      countsTowardMoneyOut: isExternalOut,
      pending: row.pending === true,
    })
  }

  activity.sort((left, right) => new Date(right.date) - new Date(left.date))

  const moneyIn = roundMoney(byKind.income + byKind.peer_in)
  const moneyOut = roundMoney(byKind.spend + byKind.peer_out)
  const internalMoved = roundMoney(byKind.internal_transfer)
  const liabilityPayments = roundMoney(byKind.liability_payment)

  return {
    moneyIn,
    moneyOut,
    net: roundMoney(moneyIn - moneyOut),
    byKind,
    internalMoved,
    liabilityPayments,
    activity: activity.slice(0, activityLimit),
    activityTotalCount: activity.length,
  }
}

/**
 * Recent ledger activity including internal/liability moves (for Quick Tools).
 */
export function buildRecentCashFlowActivity(transactions = [], limit = 12) {
  return summarizeCashFlow(transactions, { activityLimit: limit }).activity
}

/**
 * SQL fragment: headline money-in/out queries should exclude internal moves
 * and liability payments, while always keeping peer rails.
 */
export const EXCLUDE_INTERNAL_MOVES_FILTER = `
  AND (
    COALESCE(t.name, '') ~* '${PEER_PAYMENT_NAME_PATTERN}'
    OR (
      COALESCE(t.category, '') !~* 'payment'
      AND COALESCE(t.name, '') !~* '\\b(credit card|card payment|autopay|auto pay)\\b'
      AND COALESCE(t.category, '') !~* 'transfer'
      AND COALESCE(t.name, '') !~* '\\btransfer\\b'
    )
  )
`
