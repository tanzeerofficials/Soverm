/*
 * MONTH CONDITION LETTER PAGE
 *
 * Accountant-style monthly financial condition: grade, cash flow, drivers,
 * bills load, buffer, vs last month, and a plan for next month.
 */

import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import BillDefenseSection from '../components/BillDefenseSection.jsx'
import HowCalculatedDisclosure from '../components/HowCalculatedDisclosure.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { fetchMonthCondition } from '../lib/fetchMonthCondition.js'
import { monthConditionQueryKey } from '../lib/queryKeys.js'
import { buildCancelKeepWatchPrompt, buildMonthLetterSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'
import { markActivationStep } from '../lib/activationChecklist.js'
import { trackMonthLetterView } from '../lib/analytics.js'
import { useAskSoverm } from '../context/AskSovermContext.jsx'

function formatCurrency(amount) {
  if (amount == null) {
    return '—'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function gradeTone(grade) {
  if (grade === 'at_risk') {
    return 'border-danger/30 bg-danger/10'
  }
  if (grade === 'tight') {
    return 'border-warning/30 bg-warning/10'
  }
  return 'border-brand/30 bg-brand/10'
}

function MonthConditionPage() {
  const { getToken, userId } = useAuth()
  const { openChat } = useAskSoverm()
  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: monthConditionQueryKey(monthParam || 'current'),
    queryFn: () => fetchMonthCondition(getToken, monthParam),
  })

  useEffect(() => {
    if (!userId || isLoading || isError) {
      return
    }
    markActivationStep(userId, 'monthLetter')
    trackMonthLetterView()
  }, [userId, isLoading, isError])

  function selectMonth(monthKey) {
    if (!monthKey || data?.availableMonths?.find((m) => m.monthKey === monthKey)?.isCurrent) {
      setSearchParams({}, { replace: true })
      return
    }
    setSearchParams({ month: monthKey }, { replace: true })
  }

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader
          title="Month letter"
          description="Your personal accountant letter — how the month went and what to do next."
        />

        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-5 py-6 text-center">
            <p className="text-sm text-fg-muted">Couldn’t load your monthly letter.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-semibold text-brand-soft hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.availableMonths?.length > 0 && (
              <label className="block text-left">
                <span className="text-xs font-medium text-fg-muted">Month</span>
                <select
                  value={data.monthKey}
                  onChange={(event) => selectMonth(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border-default bg-surface px-3 py-2.5 text-sm text-fg sm:max-w-xs"
                >
                  {data.availableMonths.map((month) => (
                    <option key={month.monthKey} value={month.monthKey}>
                      {month.label}
                      {month.isCurrent ? ' (so far)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {data.accountCount === 0 && (
              <div className="rounded-xl border border-border-default bg-surface px-4 py-3 text-sm text-fg-muted">
                Connect a bank to unlock a full month letter.
                <Link
                  to="/dashboard"
                  className="mt-2 block text-xs font-semibold text-ai-soft hover:underline"
                >
                  Connect your bank on Dashboard
                </Link>
              </div>
            )}

            {/* M7 grade */}
            <section className={`rounded-xl border px-5 py-5 text-left ${gradeTone(data.condition?.grade)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Month letter
              </p>
              <h2 className="mt-2 text-2xl font-bold text-fg">{data.headline}</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                {data.condition?.summary}
              </p>
              <p className="mt-2 text-xs text-fg-subtle">
                Stable = cushion · Tight = little room · Needs attention = plan ahead for bills
              </p>
              <p className="mt-1 text-xs text-fg-subtle">{data.periodLabel}</p>
            </section>

            {/* M2 cash flow */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Money in vs money out
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
                Calendar month so far ({data.periodLabel}) — not the same window as Home cash flow
                (last 7 / 30 days). External cash only; own-account transfers and card payments are
                listed separately.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {data.cashFlow?.summary}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[11px] text-fg-subtle">Money in</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg">
                    {formatCurrency(data.cashFlow?.moneyIn ?? data.cashFlow?.income)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle">Money out</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg">
                    {formatCurrency(data.cashFlow?.moneyOut ?? data.cashFlow?.spent)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-fg-subtle">Net</p>
                  <p
                    className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                      (data.cashFlow?.net ?? 0) < 0 ? 'text-danger' : 'text-brand-soft'
                    }`}
                  >
                    {formatCurrency(data.cashFlow?.net)}
                  </p>
                </div>
              </div>

              {(data.cashFlow?.byKind ||
                data.cashFlow?.internalMoved > 0 ||
                data.cashFlow?.liabilityPayments > 0) && (
                <ul className="mt-4 space-y-1.5 border-t border-border-default/70 pt-3 text-xs text-fg-muted">
                  {data.cashFlow?.byKind?.income > 0 && (
                    <li className="flex justify-between gap-3">
                      <span>Income / deposits</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.byKind.income)}
                      </span>
                    </li>
                  )}
                  {data.cashFlow?.byKind?.peer_in > 0 && (
                    <li className="flex justify-between gap-3">
                      <span>Peer received (Zelle, Venmo, etc.)</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.byKind.peer_in)}
                      </span>
                    </li>
                  )}
                  {data.cashFlow?.byKind?.spend > 0 && (
                    <li className="flex justify-between gap-3">
                      <span>Spending</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.byKind.spend)}
                      </span>
                    </li>
                  )}
                  {data.cashFlow?.byKind?.peer_out > 0 && (
                    <li className="flex justify-between gap-3">
                      <span>Peer sent</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.byKind.peer_out)}
                      </span>
                    </li>
                  )}
                  {data.cashFlow?.internalMoved > 0 && (
                    <li className="flex justify-between gap-3 text-fg-subtle">
                      <span>Moved between your accounts</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.internalMoved)}
                      </span>
                    </li>
                  )}
                  {data.cashFlow?.liabilityPayments > 0 && (
                    <li className="flex justify-between gap-3 text-fg-subtle">
                      <span>Card / loan payments</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(data.cashFlow.liabilityPayments)}
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* M3 drivers */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Where money went
              </p>
              {data.drivers?.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {data.drivers.map((driver) => (
                    <li
                      key={driver.category}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-fg">{driver.category}</span>
                      <span className="shrink-0 font-mono tabular-nums text-fg-muted">
                        {formatCurrency(driver.amount)}
                        {driver.percentOfTotal != null ? ` · ${driver.percentOfTotal}%` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-fg-muted">No category spend posted for this month yet.</p>
              )}
              <Link
                to="/expense-analyzer?tab=categories"
                className="mt-3 inline-block text-xs font-semibold text-ai-soft hover:underline"
              >
                Open category breakdown
              </Link>
            </section>

            {/* M4 bills */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Bills & subscriptions
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {data.billsLoad?.summary}
              </p>
            </section>

            <BillDefenseSection
              findings={data.billDefense ?? []}
              showDecisions
              invalidateKeys={[monthConditionQueryKey(monthParam || 'current')]}
              title="Subscription flags this month"
              onAskSoverm={(finding) => {
                const prompt =
                  finding.reviewPrompt || buildCancelKeepWatchPrompt(finding)
                openChat({
                  prompt,
                  suggestedPrompts: buildMonthLetterSuggestedPrompts(),
                  contextLabel:
                    'Using this month’s condition letter and your connected accounts.',
                })
              }}
            />

            {/* M5 buffer */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Cash cushion
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {data.buffer?.summary}
              </p>
              <p className="mt-2 text-xs text-fg-subtle">
                Balance {formatCurrency(data.buffer?.netBalance)}
                {data.buffer?.runwayDays != null
                  ? ` · ~${data.buffer.runwayDays} days runway at this month’s pace`
                  : ''}
              </p>
            </section>

            {/* M6 MoM */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Vs last month
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {data.vsLastMonth?.summary}
              </p>
            </section>

            {/* M8 plan */}
            <section className="rounded-xl border border-ai/30 bg-ai/10 px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ai-soft">
                Plan for next month
              </p>
              {(data.nextMonthPlan ?? []).length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {(data.nextMonthPlan ?? []).map((move, index) => (
                    <li key={move.id} className="rounded-lg border border-border-default/60 bg-app/40 px-3 py-3">
                      <p className="text-sm font-semibold text-fg">
                        {index + 1}. {move.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{move.detail}</p>
                      {move.href && (
                        <Link
                          to={move.href}
                          className="mt-2 inline-block text-xs font-semibold text-ai-soft hover:underline"
                        >
                          {move.actionLabel || 'Open →'}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-fg-muted">
                  No specific moves yet — check back after more of the month posts.
                </p>
              )}
            </section>

            <HowCalculatedDisclosure
              title="How this letter is calculated"
              items={[
                'Income and spending use posted transactions on connected accounts for the selected calendar month (app timezone).',
                'Recurring load comes from detected / verified recurring charges.',
                'Condition grade weighs surplus/deficit, cash runway, and how heavy bills are vs income.',
                'This is a read-only accountant letter — not tax or investment advice.',
              ]}
            />

            <p className="pt-1 text-center text-xs text-fg-subtle">
              {data.isCurrentMonth
                ? 'Showing this month so far — the letter finalizes after month-end.'
                : 'Closed month letter'}
              {isFetching ? ' · refreshing…' : ''}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default MonthConditionPage
