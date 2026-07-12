/*
 * Balance display helpers
 *
 * Single source of truth for "what balance number do we show?"
 * Used by dashboard totals, account summaries for Claude, etc.
 *
 * Plaid sends two balance fields per account:
 * - balance_current: ledger balance (debt owed on credit cards / loans)
 * - balance_available: spendable cash (depository) or remaining credit (credit cards)
 *
 * We show available for checking/savings (what you can spend), but liabilities
 * must use current — that's the "balance" your bank app shows as amount owed.
 * When available is null (common on some institutions), fall back to current.
 *
 * Net total = cash/assets − liabilities (credit cards, loans, mortgages).
 * Investment accounts still count as positive assets.
 */

const LIABILITY_TYPE_PATTERN = /credit|loan|mortgage|student|line of credit|heloc/

export function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

/**
 * True for accounts whose balance is money you owe (not cash you can spend).
 * Plaid stores subtype in account_type (e.g. credit card, mortgage, student).
 */
export function isLiabilityAccount(account) {
  const type = account?.account_type?.toLowerCase() ?? ''
  return LIABILITY_TYPE_PATTERN.test(type)
}

export function getDisplayBalance(account) {
  if (isLiabilityAccount(account)) {
    return Number(account.balance_current) || 0
  }

  if (account.balance_available != null) {
    return Number(account.balance_available) || 0
  }

  return Number(account.balance_current) || 0
}

export function calculateTotalBalance(accounts) {
  return accounts.reduce((total, account) => {
    const balance = getDisplayBalance(account)
    if (isLiabilityAccount(account)) {
      return total - balance
    }
    return total + balance
  }, 0)
}
