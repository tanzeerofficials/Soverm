/*
 * CASH FLOW MONTHLY CHART
 *
 * Paired money-in / money-out bars for the last 3 calendar months — the
 * "is this trending in the right direction" glance the sparkline can't show
 * on its own (that's daily, within one range; this is month over month).
 */

import { buildCashFlowMonthlyGeometry, hasAnyCashFlowMonthlyData } from '../lib/cashFlowMonthlyChart.js'
import { formatCurrency } from '../lib/formatCurrency.js'

function CashFlowMonthlyChart({ months = [], className = '' }) {
  if (!months.length || !hasAnyCashFlowMonthlyData(months)) {
    return null
  }

  const geometry = buildCashFlowMonthlyGeometry(months)
  if (!geometry) {
    return null
  }

  return (
    <div
      className={`rounded-xl border border-border-default/80 bg-app/40 px-4 py-3 ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          Money in / out by month
        </p>
        <div className="flex items-center gap-3 text-[10px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand" aria-hidden="true" />
            In
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-danger" aria-hidden="true" />
            Out
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height + 16}`}
        className="mx-auto h-36 w-full max-w-[22rem]"
        preserveAspectRatio="none"
        role="img"
        aria-label={months
          .map((m) => `${m.monthLabel}: ${formatCurrency(m.moneyIn)} in, ${formatCurrency(m.moneyOut)} out`)
          .join('. ')}
      >
        {geometry.bars.map((bar) => (
          <g key={bar.monthKey}>
            <rect
              x={bar.inX}
              y={bar.inY}
              width={bar.barWidth}
              height={Math.max(bar.inHeight, 1)}
              rx="2"
              fill="var(--color-brand)"
            />
            <rect
              x={bar.outX}
              y={bar.outY}
              width={bar.barWidth}
              height={Math.max(bar.outHeight, 1)}
              rx="2"
              fill="var(--color-danger)"
            />
            <text
              x={bar.groupCenterX}
              y={geometry.height + 12}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-fg-subtle)"
            >
              {bar.monthLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default CashFlowMonthlyChart
