/*
 * SAVINGS TRANSFER DETECTION
 *
 * Finds likely savings deposits from Plaid transactions:
 * - Inflows on savings-like accounts (primary signal)
 * - Transfer-labeled outflows from checking (when no savings account is linked)
 *
 * Pairs on the same date/amount are deduped so one transfer is not counted twice.
 */

import { roundCurrency } from './safeToSpend.js'

export const MIN_SAVINGS_TRANSFER_AMOUNT = 10
export const MAX_SAVINGS_TRANSFER_AMOUNT = 999_999.99

const SAVINGS_ACCOUNT_SUBTYPES = new Set([
  'savings',
  'money market',
  'cd',
  'hsa',
  'cash management',
])

const EXCLUDED_NAME_PATTERNS = [
  /\binterest\b/i,
  /\bdividend\b/i,
  /\byield\b/i,
  /\bapy\b/i,
  /\bcredit card\b/i,
  /\bautopay\b/i,
  /\bloan\b/i,
  /\bmortgage\b/i,
  /\batm\b/i,
  /\bwithdrawal\b/i,
  /\bvenmo\b/i,
  /\bzelle\b/i,
  /\bcash app\b/i,
  /\bpaypal\b/i,
]

const CHECKING_TRANSFER_PATTERNS = [
  /\btransfer\b.*\bsav/i,
  /\bsav(?:ings)?\b.*\btransfer\b/i,
  /\bto savings\b/i,
  /\bxfer\b.*\bsav/i,
  /\bhigh[\s-]?yield\b/i,
  /\bhysa\b/i,
]

export function isSavingsLikeAccount(account = {}) {
  const subtype = String(account.account_type ?? account.accountType ?? '').toLowerCase()
  if (SAVINGS_ACCOUNT_SUBTYPES.has(subtype)) {
    return true
  }

  const name = String(account.account_name ?? account.accountName ?? '').toLowerCase()
  return /\bsavings\b|\bmoney market\b|\breserve\b/.test(name)
}

export function isCheckingLikeAccount(account = {}) {
  const subtype = String(account.account_type ?? account.accountType ?? '').toLowerCase()
  return subtype === 'checking' || subtype === 'prepaid' || subtype === ''
}

export function isExcludedSavingsName(name = '') {
  const normalized = String(name)
  return EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isSavingsInflowTransaction(transaction, account) {
  const amount = Number(transaction.amount)
  if (!Number.isFinite(amount) || amount >= 0) {
    return false
  }

  if (transaction.pending) {
    return false
  }

  if (!isSavingsLikeAccount(account)) {
    return false
  }

  if (isExcludedSavingsName(transaction.name)) {
    return false
  }

  const dollars = roundCurrency(Math.abs(amount))
  return dollars >= MIN_SAVINGS_TRANSFER_AMOUNT && dollars <= MAX_SAVINGS_TRANSFER_AMOUNT
}

export function isCheckingTransferToSavings(transaction, account) {
  const amount = Number(transaction.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return false
  }

  if (transaction.pending) {
    return false
  }

  if (!isCheckingLikeAccount(account)) {
    return false
  }

  const name = String(transaction.name ?? '')
  if (isExcludedSavingsName(name)) {
    return false
  }

  if (!CHECKING_TRANSFER_PATTERNS.some((pattern) => pattern.test(name))) {
    return false
  }

  const dollars = roundCurrency(amount)
  return dollars >= MIN_SAVINGS_TRANSFER_AMOUNT && dollars <= MAX_SAVINGS_TRANSFER_AMOUNT
}

function candidateKey(transaction) {
  const date = String(transaction.date).slice(0, 10)
  const cents = Math.round(Math.abs(Number(transaction.amount)) * 100)
  return `${date}|${cents}`
}

/**
 * Picks savings inflows over checking transfer labels when both sides of
 * the same transfer appear in the candidate list.
 */
export function dedupeTransferCandidates(candidates) {
  const byKey = new Map()

  for (const candidate of candidates) {
    const key = candidateKey(candidate)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, candidate)
      continue
    }

    if (candidate.signal === 'savings_inflow' && existing.signal !== 'savings_inflow') {
      byKey.set(key, candidate)
    }
  }

  return [...byKey.values()].sort((left, right) => right.date.localeCompare(left.date))
}

export function detectSavingsTransferCandidates(transactions = [], accountsById = new Map()) {
  const candidates = []

  for (const transaction of transactions) {
    const account = accountsById.get(transaction.account_id)
    if (!account) {
      continue
    }

    if (isSavingsInflowTransaction(transaction, account)) {
      candidates.push({
        transactionId: transaction.id,
        amount: roundCurrency(Math.abs(Number(transaction.amount))),
        merchantName: transaction.name || 'Savings deposit',
        date: String(transaction.date).slice(0, 10),
        accountLabel: [account.bank_name, account.account_name].filter(Boolean).join(' · '),
        signal: 'savings_inflow',
      })
      continue
    }

    if (isCheckingTransferToSavings(transaction, account)) {
      candidates.push({
        transactionId: transaction.id,
        amount: roundCurrency(Number(transaction.amount)),
        merchantName: transaction.name || 'Transfer to savings',
        date: String(transaction.date).slice(0, 10),
        accountLabel: [account.bank_name, account.account_name].filter(Boolean).join(' · '),
        signal: 'checking_transfer',
      })
    }
  }

  return dedupeTransferCandidates(candidates)
}

export function suggestTrackerForDetection(detection, savingTrackers = []) {
  if (savingTrackers.length === 0) {
    return null
  }

  if (savingTrackers.length === 1) {
    return savingTrackers[0].id
  }

  const haystack = `${detection.merchantName} ${detection.accountLabel}`.toLowerCase()
  const matched = savingTrackers.find((tracker) => haystack.includes(tracker.name.toLowerCase()))
  return matched?.id ?? savingTrackers[0].id
}
