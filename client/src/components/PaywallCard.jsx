/*
 * PAYWALL CARD
 *
 * Shown when a free-tier user hits the daily insight limit. The limit
 * is stated plainly, with a blurred preview of what a second insight
 * looks like so the value being withheld is visible rather than abstract.
 *
 * Price is anchored against the person's own spending for the period,
 * not an arbitrary "go pro!" pitch.
 */

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function PaywallCard({ spent, onUpgrade }) {
  const monthlyPrice = 5
  const hasSpendContext = typeof spent === 'number' && spent > 0
  const percentOfSpend = hasSpendContext ? (monthlyPrice / spent) * 100 : null

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1E2D45] bg-[#111827]">
      <div className="select-none p-6 opacity-60 blur-[3px]" aria-hidden="true">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
            AI CFO
          </span>
          <span className="text-xs text-[#9CA3AF]">Today</span>
        </div>
        <h3 className="mb-4 mt-4 h-7 w-3/4 rounded bg-[#1A2236] text-2xl font-bold text-[#F9FAFB]">
          &nbsp;
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg bg-[#1A2236] p-4">
              <div className="h-2.5 w-12 rounded bg-[#283250]" />
              <div className="mt-2 h-5 w-16 rounded bg-[#283250]" />
              <div className="mt-2 h-2.5 w-20 rounded bg-[#283250]" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#111827]/55 px-6 text-center">
        <span className="text-2xl" aria-hidden="true">
          🔒
        </span>
        <p className="text-sm font-semibold text-[#F9FAFB]">
          You&apos;ve used today&apos;s free insight
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-[#9CA3AF]">
          Soverm Pro gives you unlimited insights, on-demand, any time you want a fresh read on
          your money — plus your full history, not just the last 7 days.
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-1 rounded-lg bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#0A0F1C] transition hover:bg-[#FBBF24]"
        >
          Upgrade to Soverm Pro — {formatCurrency(monthlyPrice)}/mo
        </button>
        {hasSpendContext && (
          <p className="text-[11px] text-[#6B7280]">
            That&apos;s less than {percentOfSpend < 1 ? '1%' : `${Math.round(percentOfSpend)}%`} of
            what you spent this period ({formatCurrency(spent)}).
          </p>
        )}
      </div>
    </div>
  )
}

export default PaywallCard
