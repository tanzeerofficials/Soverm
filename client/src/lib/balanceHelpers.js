/*
 * Balance display helpers (client)
 *
 * Core logic must stay identical to server/utils/balanceHelpers.js.
 * The displayBalance shortcut trusts the server-computed value from the API
 * when present, so account cards match totalBalance without re-deriving.
 */

export function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

export function getDisplayBalance(account) {
  if (account.displayBalance != null) {
    return Number(account.displayBalance) || 0
  }

  if (isCreditAccount(account)) {
    return Number(account.balance_current) || 0
  }

  if (account.balance_available != null) {
    return Number(account.balance_available) || 0
  }

  return Number(account.balance_current) || 0
}
