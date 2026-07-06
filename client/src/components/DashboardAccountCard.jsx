import { getDisplayBalance, isCreditAccount } from '../lib/balanceHelpers.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function isBalanceWarning(account) {
  const balance = getDisplayBalance(account)
  if (isCreditAccount(account)) {
    return balance > 0
  }
  return balance < 0
}

function DashboardAccountCard({ account, onDisconnect }) {
  const balanceIsWarning = isBalanceWarning(account)

  return (
    <article className="relative min-w-0 rounded-xl border border-border-default bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-elevated sm:p-5">
      <button
        type="button"
        onClick={() => onDisconnect(account)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-sm text-fg-muted transition hover:text-danger"
        aria-label={`Disconnect ${account.account_name}`}
      >
        ×
      </button>
      <p className="truncate pr-8 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {account.bank_name}
      </p>
      <p className="mt-1 truncate pr-8 text-sm font-medium text-fg">
        {account.account_name}
      </p>
      <span className="mt-2 inline-block max-w-full truncate rounded-full border border-border-default bg-surface-elevated px-2.5 py-0.5 text-xs capitalize text-fg-muted">
        {account.account_type}
      </span>
      <p
        className={`mt-4 break-all font-mono text-xl font-semibold tabular-nums sm:text-2xl ${
          balanceIsWarning ? 'text-danger' : 'text-brand-soft'
        }`}
      >
        {formatCurrency(getDisplayBalance(account))}
      </p>
    </article>
  )
}

export default DashboardAccountCard
