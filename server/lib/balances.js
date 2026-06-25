/*
 * Balance display helpers
 *
 * Plaid sends two balance fields per account:
 * - balance_current: ledger balance (debt owed on credit cards)
 * - balance_available: spendable cash (depository) or remaining credit (credit cards)
 *
 * We show available for checking/savings (what you can spend), but credit cards
 * must use current — that's the "balance" your bank app shows as amount owed.
 * When available is null (common on some institutions), fall back to current.
 */

export function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

export function getDisplayBalance(account) {
  if (isCreditAccount(account)) {
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
    if (isCreditAccount(account)) {
      return total - balance
    }
    return total + balance
  }, 0)
}
