/*
 * Formats how source accounts appear on category rows and recurring charges.
 * Single source: label only. Multiple sources: label + amount per source.
 */

export function formatCategoryAccountSources(accountBreakdown) {
  if (!accountBreakdown?.length) {
    return null
  }

  if (accountBreakdown.length === 1) {
    return {
      type: 'single',
      label: accountBreakdown[0].label,
    }
  }

  return {
    type: 'multi',
    entries: accountBreakdown.map(({ label, total }) => ({ label, total })),
  }
}

export function formatRecurringAccountSource(charge) {
  const accounts = charge.accounts ?? []

  if (accounts.length === 1) {
    return { type: 'single', label: accounts[0].label }
  }

  if (accounts.length > 1) {
    return {
      type: 'multi',
      entries: accounts.map((account) => ({
        label: account.label,
      })),
    }
  }

  if (charge.accountLabel && !charge.accountLabel.includes('+')) {
    return { type: 'single', label: charge.accountLabel }
  }

  if (charge.accountLabel) {
    return { type: 'combined', label: charge.accountLabel }
  }

  return null
}
