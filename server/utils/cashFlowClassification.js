/*
 * CASH FLOW CLASSIFICATION
 *
 * Every posted connected-account transaction gets exactly one kind.
 * Labels stay specific (Self deposit, Self transfer, Cash out, Zelle, …)
 * so users can see everything under one roof without vague “Transfer” buckets.
 *
 * Headline Money in / Money out only count external cash. Self transfers and
 * card/loan payments are tracked separately so we never double-count.
 */

export const CASH_FLOW_KINDS = {
  SELF_DEPOSIT: 'self_deposit',
  INCOME: 'income',
  PEER_IN: 'peer_in',
  SPEND: 'spend',
  PEER_OUT: 'peer_out',
  CASH_OUT: 'cash_out',
  SELF_TRANSFER: 'self_transfer',
  LIABILITY_PAYMENT: 'liability_payment',
}

/** @deprecated Use SELF_TRANSFER — kept so older clients reading the string still match. */
export const INTERNAL_TRANSFER_KIND = CASH_FLOW_KINDS.SELF_TRANSFER

export const MONEY_IN_KINDS = new Set([
  CASH_FLOW_KINDS.SELF_DEPOSIT,
  CASH_FLOW_KINDS.INCOME,
  CASH_FLOW_KINDS.PEER_IN,
])

export const MONEY_OUT_KINDS = new Set([
  CASH_FLOW_KINDS.SPEND,
  CASH_FLOW_KINDS.PEER_OUT,
  CASH_FLOW_KINDS.CASH_OUT,
])

/** Peer rails — money exchanged with another person. */
export const PEER_PAYMENT_NAME_PATTERN =
  '\\b(zelle|venmo|cash ?app|cashapp|paypal|taptap|tap tap|wise|remitly|western union|apple cash|google pay)\\b'

/**
 * ATM / mobile / check / counter deposits you put in yourself.
 * Deliberately excludes payroll language — "DIRECT DEPOSIT ACME" is Income,
 * not Self deposit. Bare "deposit" still matches BoA-style memos like DES:DEPOSIT.
 */
export const DEPOSIT_NAME_PATTERN =
  '\\b(deposit|deposited|(?:mobile|atm|counter|check|cash|remote|online)\\s*deposit)\\b'

/**
 * Paycheck / direct-deposit language — these are Income, never Self deposit.
 */
export const PAYROLL_INCOME_NAME_PATTERN =
  '\\b(payroll|salary|wages|paycheck|paycheque|direct\\s*dep(?:osit)?|dir\\s*dep|adp\\b|gusto\\b|paychex|paylocity)\\b'

/** ATM / teller cash withdrawals — money leaving as cash, not a merchant swipe. */
export const CASH_OUT_NAME_PATTERN =
  '\\b(atm\\s*(?:cash\\s*)?withdraw(?:al)?s?|atm\\s*cash|cash\\s*withdraw(?:al)?s?|withdraw\\s*cash)\\b'

const PEER_PAYMENT_REGEX = new RegExp(PEER_PAYMENT_NAME_PATTERN, 'i')
const DEPOSIT_NAME_REGEX = new RegExp(DEPOSIT_NAME_PATTERN, 'i')
const PAYROLL_INCOME_REGEX = new RegExp(PAYROLL_INCOME_NAME_PATTERN, 'i')
const CASH_OUT_NAME_REGEX = new RegExp(CASH_OUT_NAME_PATTERN, 'i')
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

/** True when the memo looks like paycheck / direct deposit income. */
export function isPayrollIncomeTransaction(row) {
  if (!row) {
    return false
  }
  return PAYROLL_INCOME_REGEX.test(normalizeText(row.name))
}

/**
 * True when the memo looks like a bank deposit you made (ATM, mobile, check).
 * Payroll direct deposits are excluded so they stay Income.
 */
export function isDepositTransaction(row) {
  if (!row || isPayrollIncomeTransaction(row)) {
    return false
  }
  return DEPOSIT_NAME_REGEX.test(normalizeText(row.name))
}

/** True when the memo looks like an ATM / cash withdrawal. */
export function isCashOutTransaction(row) {
  if (!row) {
    return false
  }
  const name = normalizeText(row.name)
  const category = normalizeText(row.category)
  if (CASH_OUT_NAME_REGEX.test(name)) {
    return true
  }
  // Plaid sometimes stores category "ATM" without "withdraw" in the name.
  if (category === 'atm' || category.includes('atm')) {
    const amount = Number(row.amount)
    return Number.isFinite(amount) && amount > 0
  }
  return false
}

function isLiabilityPaymentTransaction(row) {
  if (isPeerPaymentTransaction(row) || isDepositTransaction(row) || isCashOutTransaction(row)) {
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
  if (
    isPeerPaymentTransaction(row) ||
    isLiabilityPaymentTransaction(row) ||
    isCashOutTransaction(row)
  ) {
    return false
  }

  // Deposit *credits* are external money in. Deposit-named *debits*
  // (e.g. keep-the-change to savings) can still be self transfers.
  const amount = Number(row?.amount)
  if (isDepositTransaction(row) && Number.isFinite(amount) && amount < 0) {
    return false
  }

  const category = normalizeText(row?.category)
  const name = normalizeText(row?.name)

  // Already-labeled Self transfer / Self deposit should not fall through oddly.
  if (category === 'self transfer') {
    return true
  }
  if (category === 'self deposit') {
    return false
  }

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

  const category = normalizeText(row.category)

  // Paycheck language wins over a stale "Self deposit" category from an old sync.
  if (isPayrollIncomeTransaction(row) && amount < 0) {
    return CASH_FLOW_KINDS.INCOME
  }

  if (
    (isDepositTransaction(row) || category === 'self deposit') &&
    amount < 0
  ) {
    return CASH_FLOW_KINDS.SELF_DEPOSIT
  }

  if (
    (isCashOutTransaction(row) || category === 'cash out') &&
    amount > 0
  ) {
    return CASH_FLOW_KINDS.CASH_OUT
  }

  if (isLiabilityPaymentTransaction(row)) {
    return CASH_FLOW_KINDS.LIABILITY_PAYMENT
  }

  if (isOwnAccountTransferTransaction(row) || category === 'self transfer') {
    return CASH_FLOW_KINDS.SELF_TRANSFER
  }

  return amount < 0 ? CASH_FLOW_KINDS.INCOME : CASH_FLOW_KINDS.SPEND
}

export function isInternalMoveTransaction(row) {
  if (!row || row.pending === true) {
    return false
  }

  const kind = classifyCashFlowTransaction({
    ...row,
    date: row.date || '1970-01-01',
  })

  return (
    kind === CASH_FLOW_KINDS.SELF_TRANSFER ||
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
  [CASH_FLOW_KINDS.SELF_DEPOSIT]: 'Self deposit',
  [CASH_FLOW_KINDS.INCOME]: 'Income',
  [CASH_FLOW_KINDS.PEER_IN]: 'Peer received',
  [CASH_FLOW_KINDS.SPEND]: 'Spending',
  [CASH_FLOW_KINDS.PEER_OUT]: 'Peer sent',
  [CASH_FLOW_KINDS.CASH_OUT]: 'Cash out',
  [CASH_FLOW_KINDS.SELF_TRANSFER]: 'Self transfer',
  [CASH_FLOW_KINDS.LIABILITY_PAYMENT]: 'Card/loan payment',
}

export const KIND_BADGES = {
  [CASH_FLOW_KINDS.SELF_DEPOSIT]: 'Self deposit',
  [CASH_FLOW_KINDS.INCOME]: 'Income',
  [CASH_FLOW_KINDS.PEER_IN]: 'Peer in',
  [CASH_FLOW_KINDS.SPEND]: 'Spent',
  [CASH_FLOW_KINDS.PEER_OUT]: 'Peer out',
  [CASH_FLOW_KINDS.CASH_OUT]: 'Cash out',
  [CASH_FLOW_KINDS.SELF_TRANSFER]: 'Self transfer',
  [CASH_FLOW_KINDS.LIABILITY_PAYMENT]: 'Card payment',
}

/** Display category for activity rows — always specific, never vague “Transfer”. */
export function resolveCashFlowDisplayCategory(kind, row = {}) {
  switch (kind) {
    case CASH_FLOW_KINDS.SELF_DEPOSIT:
      return 'Self deposit'
    case CASH_FLOW_KINDS.CASH_OUT:
      return 'Cash out'
    case CASH_FLOW_KINDS.SELF_TRANSFER:
      return 'Self transfer'
    case CASH_FLOW_KINDS.PEER_IN:
    case CASH_FLOW_KINDS.PEER_OUT:
      return 'Peer transfer'
    case CASH_FLOW_KINDS.LIABILITY_PAYMENT:
      return 'Card/loan payment'
    case CASH_FLOW_KINDS.INCOME:
      return row.category && !normalizeText(row.category).includes('transfer')
        ? row.category
        : 'Income'
    case CASH_FLOW_KINDS.SPEND:
      return row.category && !normalizeText(row.category).includes('transfer')
        ? row.category
        : 'Spending'
    default:
      return row.category || KIND_LABELS[kind] || 'Activity'
  }
}

/** Prefer rail-specific badges (Zelle in/out) when the name names the rail. */
export function resolveCashFlowBadge(kind, name = '', amount = null) {
  if (kind === CASH_FLOW_KINDS.SELF_TRANSFER) {
    if (Number.isFinite(Number(amount))) {
      return Number(amount) < 0 ? 'Self transfer in' : 'Self transfer out'
    }
    return 'Self transfer'
  }

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
    [CASH_FLOW_KINDS.SELF_DEPOSIT]: 0,
    [CASH_FLOW_KINDS.INCOME]: 0,
    [CASH_FLOW_KINDS.PEER_IN]: 0,
    [CASH_FLOW_KINDS.SPEND]: 0,
    [CASH_FLOW_KINDS.PEER_OUT]: 0,
    [CASH_FLOW_KINDS.CASH_OUT]: 0,
    [CASH_FLOW_KINDS.SELF_TRANSFER]: 0,
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
      category: resolveCashFlowDisplayCategory(kind, row),
      amount: absolute,
      kind,
      kindLabel: KIND_LABELS[kind],
      badge: resolveCashFlowBadge(kind, row.name, row.amount),
      direction: isInflow ? 'in' : 'out',
      countsTowardMoneyIn: isExternalIn,
      countsTowardMoneyOut: isExternalOut,
      pending: row.pending === true,
    })
  }

  activity.sort((left, right) => new Date(right.date) - new Date(left.date))

  const moneyIn = roundMoney(
    byKind.self_deposit + byKind.income + byKind.peer_in
  )
  const moneyOut = roundMoney(byKind.spend + byKind.peer_out + byKind.cash_out)
  const selfTransfers = roundMoney(byKind.self_transfer)
  const liabilityPayments = roundMoney(byKind.liability_payment)

  return {
    moneyIn,
    moneyOut,
    net: roundMoney(moneyIn - moneyOut),
    byKind,
    selfTransfers,
    /** @deprecated Prefer selfTransfers — same total. */
    internalMoved: selfTransfers,
    liabilityPayments,
    activity: activity.slice(0, activityLimit),
    activityTotalCount: activity.length,
  }
}

/**
 * Recent ledger activity including self transfers / card payments (Quick Tools).
 */
export function buildRecentCashFlowActivity(transactions = [], limit = 12) {
  return summarizeCashFlow(transactions, { activityLimit: limit }).activity
}

/**
 * SQL fragment: headline money-in/out queries should exclude self transfers
 * and liability payments, while always keeping peer rails, self deposits,
 * and cash outs.
 */
export const EXCLUDE_INTERNAL_MOVES_FILTER = `
  AND (
    COALESCE(t.name, '') ~* '${PEER_PAYMENT_NAME_PATTERN}'
    OR (
      t.amount < 0
      AND COALESCE(t.name, '') ~* '${DEPOSIT_NAME_PATTERN}'
      AND COALESCE(t.name, '') !~* '${PAYROLL_INCOME_NAME_PATTERN}'
    )
    OR (
      t.amount > 0
      AND (
        COALESCE(t.name, '') ~* '${CASH_OUT_NAME_PATTERN}'
        OR COALESCE(t.category, '') ~* '\\batm\\b'
      )
    )
    OR (
      COALESCE(t.category, '') !~* 'payment'
      AND COALESCE(t.name, '') !~* '\\b(credit card|card payment|autopay|auto pay)\\b'
      AND COALESCE(t.category, '') !~* 'transfer'
      AND COALESCE(t.name, '') !~* '\\btransfer\\b'
      AND COALESCE(t.category, '') !~* 'self transfer'
    )
  )
`
