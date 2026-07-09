/*
 * FORECAST TOOL PANEL
 *
 * Quick Tools tab — 30-day projected balance using recurring charges
 * and recent income/spending patterns.
 */

import { Link } from 'react-router-dom'
import Skeleton from '../Skeleton.jsx'
import HowCalculatedDisclosure from '../HowCalculatedDisclosure.jsx'
import {
  buildForecastSparkline,
  formatForecastDate,
  FORECAST_HORIZON_DAYS,
  toneStyles,
} from '../../lib/cashFlowForecast.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

function ForecastSparkline({ points, tone }) {
  const { path, areaPath } = buildForecastSparkline(points)
  const styles = toneStyles(tone)

  return (
    <svg viewBox="0 0 280 72" className="h-20 w-full" role="img" aria-hidden="true">
      <path d={areaPath} className={styles.chartFill} />
      <path
        d={path}
        fill="none"
        className={styles.chartStroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ForecastToolPanel({ forecast, isLoading, loadError, onRetryLoad }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-4">
        <p className="text-sm font-medium text-danger">Could not load forecast</p>
        <p className="mt-1 text-xs text-fg-muted">{loadError}</p>
        {onRetryLoad ? (
          <button
            type="button"
            onClick={onRetryLoad}
            className="mt-3 text-xs font-semibold text-brand-soft hover:underline"
          >
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (!forecast || forecast.accountCount === 0) {
    return (
      <div>
        <p className="text-sm text-fg-muted">
          Connect a bank account to project your balance over the next {FORECAST_HORIZON_DAYS} days.
        </p>
      </div>
    )
  }

  const risk = forecast.risk
  const riskStyles = toneStyles(risk?.tone)

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-4 ${riskStyles.border}`}>
        <p className={`text-sm font-semibold ${riskStyles.text}`}>{risk?.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{risk?.detail}</p>
      </div>

      <div className="rounded-lg border border-border-default bg-app/40 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Projected balance · {FORECAST_HORIZON_DAYS} days
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fg">
              {formatCurrency(forecast.endingBalance)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Today {formatCurrency(forecast.startingBalance)}
              {forecast.lowestBalance < forecast.startingBalance
                ? ` · Low around ${formatForecastDate(forecast.lowestBalanceDate)} (${formatCurrency(forecast.lowestBalance)})`
                : ''}
            </p>
          </div>
          {forecast.runwayDays != null ? (
            <p className="text-xs text-fg-subtle">
              Runway ~<span className="font-mono tabular-nums text-fg-muted">{forecast.runwayDays}</span> days
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <ForecastSparkline points={forecast.points} tone={risk?.tone} />
        </div>
      </div>

      {forecast.scheduledOutflows?.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Upcoming recurring charges
          </p>
          <ul className="mt-2 divide-y divide-border-default/80 rounded-lg border border-border-default bg-app/30">
            {forecast.scheduledOutflows.map((event) => (
              <li
                key={`${event.date}-${event.merchant}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{event.merchant}</p>
                  <p className="text-xs text-fg-subtle">{formatForecastDate(event.date)}</p>
                </div>
                <span className="font-mono text-sm tabular-nums text-fg">
                  {formatCurrency(event.amount)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/expense-analyzer?tab=recurring"
            className="mt-3 inline-flex text-xs font-medium text-ai-soft hover:underline"
          >
            View all recurring charges →
          </Link>
        </div>
      ) : (
        <p className="text-xs text-fg-muted">
          No confirmed recurring charges scheduled in the next {FORECAST_HORIZON_DAYS} days.
        </p>
      )}

      <HowCalculatedDisclosure
        title="How this forecast works"
        items={[
          `Starts from your connected account balances (${formatCurrency(forecast.startingBalance)}).`,
          `Adds ~${formatCurrency(forecast.assumptions?.dailyIncome)}/day income based on the last 30 days.`,
          `Subtracts ~${formatCurrency(forecast.assumptions?.dailyDiscretionary)}/day discretionary spend plus confirmed recurring charges on their expected dates.`,
          'This is an estimate — paycheck timing and one-off purchases can shift the real outcome.',
        ]}
      />
    </div>
  )
}

export default ForecastToolPanel
