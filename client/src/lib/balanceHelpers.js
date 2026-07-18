/*
 * Balance display helpers (client)
 *
 * Core logic must stay identical to server/utils/balanceHelpers.js.
 * The displayBalance shortcut trusts the server-computed value from the API
 * when present, so account cards match totalBalance without re-deriving.
 */

const LIABILITY_TYPE_PATTERN = /credit|loan|mortgage|student|line of credit|heloc/

export function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

export function isLiabilityAccount(account) {
  const type = account?.account_type?.toLowerCase() ?? ''
  return LIABILITY_TYPE_PATTERN.test(type)
}

export function getDisplayBalance(account) {
  if (account.displayBalance != null) {
    return Number(account.displayBalance) || 0
  }

  if (isLiabilityAccount(account)) {
    return Number(account.balance_current) || 0
  }

  if (account.balance_available != null) {
    return Number(account.balance_available) || 0
  }

  return Number(account.balance_current) || 0
}

/**
 * Credit cards only: amount owed / drawn (Plaid current).
 * Prefers server-enriched creditSpent when the dashboard API sent it.
 */
export function getCreditSpent(account) {
  if (!isCreditAccount(account)) return null
  if (account.creditSpent != null) return Number(account.creditSpent) || 0
  return Number(account.balance_current) || 0
}

/**
 * Credit cards only: remaining credit (Plaid available).
 * Prefers server-enriched creditAvailable; null if the bank did not report it.
 */
export function getCreditAvailable(account) {
  if (!isCreditAccount(account)) return null
  if (account.creditAvailable !== undefined) {
    return account.creditAvailable == null ? null : Number(account.creditAvailable) || 0
  }
  if (account.balance_available == null) return null
  return Number(account.balance_available) || 0
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
