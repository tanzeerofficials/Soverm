import { formatDistanceToNow } from 'date-fns'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js'
import { fillSpendingSeries } from '../lib/spendingSparkline.js'
import { isSpendingCapWarningActive } from '../lib/spendingAlertThresholds.js'
import CashFlowSummary from './CashFlowSummary.jsx'
import SpendingSparkline from './SpendingSparkline.jsx'
import HowCalculatedDisclosure from './HowCalculatedDisclosure.jsx'
import { formatCurrency } from '../lib/formatCurrency.js'

const RANGE_OPTIONS = [
  { value: 'mtd', label: 'Month' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
]

const RANGE_LABELS = {
  mtd: 'this calendar month so far',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  '3m': 'in the last 3 months',
  '1y': 'in the last year',
}

const WHATS_LEFT_HELP = [
  'What’s left = your connected account balance minus known bills due on or before your next payday.',
  'Bills come from detected recurring charges (rent, subscriptions, etc.) scheduled before payday.',
  'No extra buffer is reserved yet (buffer = $0). A spending cap “safe to spend” is separate if you set one.',
  'Confirm or edit payday anytime in Profile.',
]

function DashboardHero({
  hasAccounts,
  totalBalance = 0,
  lastSyncedAt,
  selectedRange,
  onRangeChange,
  income = 0,
  spent = 0,
  cashFlow = null,
  spendingSeries = [],
  periodStart = null,
  todayIso = null,
  trackerSnapshot = null,
  trackerLoading = false,
}) {
  const whatsLeft = trackerSnapshot?.whatsLeftUntilPayday
  const whatsLeftConfigured = whatsLeft?.configured === true
  const animatedBalance = useAnimatedNumber(totalBalance)
  const animatedWhatsLeft = useAnimatedNumber(whatsLeft?.amount ?? 0)
  const animatedSafeToSpend = useAnimatedNumber(trackerSnapshot?.safeToSpend ?? 0)
  const filledSpendingSeries = useMemo(
    () =>
      fillSpendingSeries(spendingSeries, selectedRange, {
        periodStart,
        todayIso,
      }),
    [spendingSeries, selectedRange, periodStart, todayIso]
  )
  const hasSpendingTracker =
    trackerSnapshot?.spendingTracker != null || trackerSnapshot?.configured === true
  const spendingProgress = trackerSnapshot?.spendingTracker?.progress ?? null
  const primarySaving = trackerSnapshot?.savingTrackers?.[0]
  const hasSavingOnly = !hasSpendingTracker && Boolean(primarySaving)
  const [showCashFlow, setShowCashFlow] = useState(false)

  if (!hasAccounts) {
    return (
      <section
        id="dashboard-hero"
        className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-surface-deep/90 via-surface to-app px-6 py-10 text-center sm:px-10 sm:py-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_65%)]" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand">Step 1</p>
          <h2 className="mt-3 text-2xl font-bold text-fg sm:text-3xl">
            Connect your bank to get started
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-muted">
            Soverm needs your accounts linked before it can analyze your finances. Your bank login
            stays with Plaid — we never see it.
          </p>
        </div>
      </section>
    )
  }

  if (trackerLoading && trackerSnapshot == null) {
    return (
      <section
        id="dashboard-hero"
        className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-surface-deep/90 via-surface to-app px-6 py-10 text-center sm:px-10 sm:py-12"
        aria-busy="true"
        aria-label="Loading balance summary"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_60%)]" />
        <div className="relative space-y-4">
          <div className="mx-auto h-3 w-28 animate-pulse rounded bg-surface-elevated" />
          <div className="mx-auto h-14 w-48 animate-pulse rounded bg-surface-elevated sm:h-16 sm:w-64" />
          <div className="mx-auto h-4 w-56 animate-pulse rounded bg-surface-elevated" />
        </div>
      </section>
    )
  }

  return (
    <section
      id="dashboard-hero"
      className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-surface-deep/90 via-surface to-app px-6 py-10 text-center card-shadow-md sm:px-10 sm:py-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ai/10 blur-3xl" />

      <div className="relative">
        {whatsLeftConfigured ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fg-muted">
              What’s left until payday
            </p>
            <p className="mt-4 font-mono text-4xl font-light tabular-nums tracking-tight text-brand-soft sm:text-6xl md:text-7xl">
              {formatCurrency(animatedWhatsLeft)}
            </p>
            <p className="mt-3 text-sm text-fg-muted">
              {whatsLeft.daysUntilPayday === 0
                ? 'Payday is today'
                : `${whatsLeft.daysUntilPayday} day${whatsLeft.daysUntilPayday === 1 ? '' : 's'} until ${whatsLeft.nextPaydayOn}`}
              {whatsLeft.billsUntilPaydayTotal > 0
                ? ` · ${formatCurrency(whatsLeft.billsUntilPaydayTotal)} in bills before then`
                : ' · no known bills before payday'}
            </p>
            <p className="mt-4 text-xs text-fg-subtle">
              Total balance {formatCurrency(totalBalance)}
              {trackerSnapshot?.accountCount > 0
                ? ` · ${trackerSnapshot.accountCount} connected account${trackerSnapshot.accountCount === 1 ? '' : 's'}`
                : ''}
            </p>
            <HowCalculatedDisclosure title="How what’s left is calculated" items={WHATS_LEFT_HELP} />
          </>
        ) : hasSpendingTracker ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fg-muted">
              Safe to spend
            </p>
            <p
              className={`mt-4 font-mono text-4xl font-light tabular-nums tracking-tight sm:text-6xl md:text-7xl ${
                trackerSnapshot?.isOverBudget || spendingProgress?.isOver ? 'text-danger' : 'text-brand-soft'
              }`}
            >
              {formatCurrency(animatedSafeToSpend)}
            </p>
            <p className="mt-3 text-sm text-fg-muted">
              {trackerSnapshot?.isOverBudget || spendingProgress?.isOver
                ? `Over spending cap by ${formatCurrency(trackerSnapshot?.overBudgetBy ?? spendingProgress?.overBy)} · ${trackerSnapshot?.periodLabel}`
                : `${formatCurrency(trackerSnapshot?.spentThisMonth)} of ${formatCurrency(trackerSnapshot?.monthlyBudget)} spent · ${trackerSnapshot?.periodLabel}`}
            </p>
            {primarySaving && (
              <p className="mt-1 text-xs text-fg-subtle">
                Saving tracker:{' '}
                {formatCurrency(
                  primarySaving.progress?.savedThisMonth ?? primarySaving.progress?.saved ?? 0
                )}{' '}
                of {formatCurrency(primarySaving.monthlyAmount)} this month
              </p>
            )}
            <div className="mx-auto mt-4 max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={`h-full rounded-full ${
                    trackerSnapshot?.isOverBudget || spendingProgress?.isOver
                      ? 'bg-danger'
                      : isSpendingCapWarningActive(
                            trackerSnapshot?.spendingTracker,
                            spendingProgress ?? {
                              percentUsed: trackerSnapshot?.percentUsed,
                              remaining: trackerSnapshot?.remainingBudget,
                              isOver: trackerSnapshot?.isOverBudget,
                            }
                          )
                        ? 'bg-warning'
                        : 'bg-brand'
                  }`}
                  style={{
                    width: `${Math.min(trackerSnapshot?.percentUsed ?? spendingProgress?.percentUsed ?? 0, 100)}%`,
                  }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              Total balance {formatCurrency(totalBalance)}
              {trackerSnapshot?.accountCount > 0
                ? ` · ${trackerSnapshot.accountCount} connected account${trackerSnapshot.accountCount === 1 ? '' : 's'}`
                : ''}
            </p>
            <HowCalculatedDisclosure
              title="How spending tracking works"
              items={[
                'Compares outflows from connected accounts this calendar month against your spending cap.',
                'Safe to spend is what is left of that cap, capped by your net account balance.',
                'Saving trackers are tracked separately in Quick tools → Tracker.',
                'Pending transactions are excluded until they post.',
              ]}
            />
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-border-default bg-app/50 px-4 py-3 text-left">
              <p className="text-sm font-medium text-fg">Confirm payday to see what’s left</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                We’ll subtract known bills before your next paycheck from your balance.
              </p>
              <Link
                to="/settings"
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft"
              >
                Set payday in Profile
              </Link>
            </div>
          </>
        ) : hasSavingOnly ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fg-muted">
              Savings goal
            </p>
            <p className="mt-4 font-mono text-4xl font-light tabular-nums tracking-tight text-brand-soft sm:text-6xl md:text-7xl">
              {formatCurrency(
                primarySaving.progress?.savedThisMonth ?? primarySaving.progress?.saved ?? 0
              )}
            </p>
            <p className="mt-3 text-sm text-fg-muted">
              {primarySaving.name}:{' '}
              {formatCurrency(
                primarySaving.progress?.savedThisMonth ?? primarySaving.progress?.saved ?? 0
              )}{' '}
              of {formatCurrency(primarySaving.monthlyAmount)} this month
              {trackerSnapshot?.periodLabel ? ` · ${trackerSnapshot.periodLabel}` : ''}
            </p>
            <div className="mx-auto mt-4 max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${Math.min(
                      ((primarySaving.progress?.savedThisMonth ??
                        primarySaving.progress?.saved ??
                        0) /
                        Math.max(primarySaving.monthlyAmount || 1, 1)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              Total balance {formatCurrency(totalBalance)}
            </p>
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-border-default bg-app/50 px-4 py-3 text-left">
              <p className="text-sm font-medium text-fg">Confirm payday to see what’s left</p>
              <Link
                to="/settings"
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft"
              >
                Set payday in Profile
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fg-muted">
              Total balance
            </p>
            <p className="mt-4 font-mono text-4xl font-light tabular-nums tracking-tight text-fg sm:text-6xl md:text-7xl">
              {formatCurrency(animatedBalance)}
            </p>
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-border-default bg-app/50 px-4 py-3 text-left">
              <p className="text-sm font-medium text-fg">Confirm payday so we can show what’s left</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Balance minus known bills before your next paycheck — the number paycheck-to-paycheck
                users check most.
              </p>
              <Link
                to="/settings"
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft"
              >
                Set payday in Profile
              </Link>
            </div>
          </>
        )}

        {lastSyncedAt && (
          <>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fg-muted">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              Last synced {formatDistanceToNow(new Date(lastSyncedAt))} ago
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              Recent transactions may take a few minutes to appear
            </p>
          </>
        )}

        <div className="mx-auto mt-6 max-w-xl">
          <button
            type="button"
            onClick={() => setShowCashFlow((open) => !open)}
            className="text-xs font-semibold text-fg-muted transition hover:text-fg"
            aria-expanded={showCashFlow}
          >
            {showCashFlow ? 'Hide period cash flow' : 'Show period cash flow'}
          </button>

          {showCashFlow && (
            <div className="mt-4">
              <div className="inline-flex rounded-full border border-border-default bg-app/50 p-1">
                {RANGE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onRangeChange(value)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      selectedRange === value
                        ? 'bg-brand text-brand-fg shadow-sm'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mx-auto mt-6 max-w-sm">
                <SpendingSparkline series={filledSpendingSeries} />
              </div>

              <CashFlowSummary
                income={income}
                spent={spent}
                cashFlow={cashFlow}
                rangeLabel={RANGE_LABELS[selectedRange]}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default DashboardHero
