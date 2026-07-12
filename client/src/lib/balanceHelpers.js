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

export function calculateTotalBalance(accounts) {
  return accounts.reduce((total, account) => {
    const balance = getDisplayBalance(account)
    if (isLiabilityAccount(account)) {
      return total - balance
    }
    return total + balance
  }, 0)
}
