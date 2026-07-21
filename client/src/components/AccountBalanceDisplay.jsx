/*
 * ACCOUNT BALANCE DISPLAY
 *
 * Checking/savings: one spendable balance.
 * Credit cards: spent (owed) + available credit when Plaid reports it.
 * Other liabilities (loans/mortgages): amount owed only.
 */

import { formatCurrency } from '../lib/formatCurrency.js'
import {
  getCreditAvailable,
  getCreditSpent,
  getDisplayBalance,
  isCreditAccount,
  isLiabilityAccount,
} from '../lib/balanceHelpers.js'

function AccountBalanceDisplay({ account, align = 'right', size = 'sm' }) {
  const alignClass = align === 'left' ? 'text-left' : 'text-right'
  const primarySize = size === 'lg' ? 'text-xl sm:text-2xl' : 'text-sm'
  const secondarySize = size === 'lg' ? 'text-sm' : 'text-xs'

  if (isCreditAccount(account)) {
    const spent = getCreditSpent(account) ?? 0
    const available = getCreditAvailable(account)
    const spentTone = spent > 0 ? 'text-danger' : 'text-brand-soft'

    return (
      <div className={`shrink-0 ${alignClass}`}>
        <p className={`font-mono font-semibold tabular-nums ${primarySize} ${spentTone}`}>
          {formatCurrency(spent)}
          <span className="ml-1 font-sans text-[0.7em] font-medium text-fg-subtle">spent</span>
        </p>
        {available != null ? (
          <p className={`mt-0.5 font-mono tabular-nums text-brand-soft ${secondarySize}`}>
            {formatCurrency(available)}
            <span className="ml-1 font-sans text-fg-subtle">available</span>
          </p>
        ) : null}
      </div>
    )
  }

  const balance = getDisplayBalance(account)
  const isWarning = isLiabilityAccount(account) ? balance > 0 : balance < 0

  return (
    <p
      className={`shrink-0 font-mono font-semibold tabular-nums ${primarySize} ${alignClass} ${
        isWarning ? 'text-danger' : 'text-brand-soft'
      }`}
    >
      {formatCurrency(balance)}
    </p>
  )
}

export default AccountBalanceDisplay
