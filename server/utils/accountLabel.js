export function formatAccountLabel(account) {
  if (!account) {
    return 'Unknown account'
  }

  if (account.bankName && account.name) {
    return `${account.bankName} · ${account.name}`
  }

  return account.name || account.bankName || 'Unknown account'
}
