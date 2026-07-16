/*
 * DASHBOARD CONNECTED ACCOUNTS
 *
 * Overview snapshot: how many accounts are linked and each current balance.
 * Disconnect / add another bank stays in Profile so Home stays scan-friendly.
 */

import { Link } from 'react-router-dom'
import { getDisplayBalance, isLiabilityAccount } from '../lib/balanceHelpers.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function balanceTone(account) {
  const balance = getDisplayBalance(account)
  if (isLiabilityAccount(account)) {
    return balance > 0 ? 'text-danger' : 'text-brand-soft'
  }
  return balance < 0 ? 'text-danger' : 'text-brand-soft'
}

function DashboardConnectedAccounts({ accounts = [] }) {
  if (accounts.length === 0) {
    return null
  }

  const count = accounts.length

  return (
    <section
      aria-labelledby="connected-accounts-heading"
      className="rounded-xl border border-border-default bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fg-subtle">
            Connected accounts
          </p>
          <h2 id="connected-accounts-heading" className="mt-1 text-base font-semibold text-fg">
            {count} account{count === 1 ? '' : 's'} linked
          </h2>
        </div>
        <Link
          to="/settings"
          className="text-xs font-semibold text-ai-soft transition hover:underline"
        >
          Manage in Profile →
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-border-default/80">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{account.account_name}</p>
              <p className="mt-0.5 truncate text-xs text-fg-subtle">
                {account.bank_name}
                {account.account_type ? ` · ${account.account_type}` : ''}
              </p>
            </div>
            <p
              className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${balanceTone(account)}`}
            >
              {formatCurrency(getDisplayBalance(account))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DashboardConnectedAccounts
