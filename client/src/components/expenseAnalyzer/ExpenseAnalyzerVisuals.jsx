/*
 * Dedicated top-of-page visual section — composition donuts + readable legend.
 * Category / recurring cards below stay text-only (no embedded charts).
 */

import { useState } from 'react'
import DonutChart from './DonutChart.jsx'
import StatDeltaBadge from '../StatDeltaBadge.jsx'
import { formatCurrency } from './ExpenseAnalyzerDisplay.jsx'
import {
  formatPercent,
  prepareDonutSlices,
  prepareRecurringSlices,
} from '../../lib/spendingVisualUtils.js'

function VisualLegend({ slices, activeKey, onHover, formatAmount, variant = 'split' }) {
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {slices.map((slice) => {
        const isActive = activeKey === slice.key
        const isDimmed = activeKey != null && !isActive
        const label = slice.label || 'Unknown'

        return (
          <li key={slice.key}>
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                isActive ? 'bg-[#1A2236]' : 'hover:bg-[#1A2236]/60'
              } ${isDimmed ? 'opacity-50' : ''}`}
              onMouseEnter={() => onHover(slice.key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(slice.key)}
              onBlur={() => onHover(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />

              {variant === 'combined' ? (
                <>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[#F9FAFB]">{label}</span>
                    <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-[#F9FAFB]">
                      {formatAmount(slice.amount)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-[#9CA3AF]">
                    {formatPercent(slice.percent)}
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#F9FAFB]">
                    {label}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[#F9FAFB]">
                    {formatAmount(slice.amount)}
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[#9CA3AF]">
                    {formatPercent(slice.percent)}
                  </span>
                </>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function VisualBlock({
  title,
  subtitle,
  slices,
  total,
  centerSubLabel,
  formatAmount,
  ariaLabel,
  size = 'default',
  showHeader = true,
  formatCenterAmount,
  legendVariant = 'split',
}) {
  const [activeKey, setActiveKey] = useState(null)

  if (!slices.length) {
    return null
  }

  return (
    <div>
      {showHeader && (title || subtitle) && (
        <div className="mb-4">
          {title && (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9CA3AF]">
              {title}
            </p>
          )}
          {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
        </div>
      )}

      <div
        className={`flex flex-col gap-6 ${
          size === 'compact'
            ? 'sm:flex-row sm:items-start'
            : 'lg:flex-row lg:items-center'
        }`}
      >
        <DonutChart
          slices={slices}
          centerLabel={(formatCenterAmount ?? formatAmount)(total)}
          centerSubLabel={centerSubLabel}
          ariaLabel={ariaLabel}
          size={size}
          activeKey={activeKey}
          onSegmentHover={setActiveKey}
        />
        <VisualLegend
          slices={slices}
          activeKey={activeKey}
          onHover={setActiveKey}
          formatAmount={formatAmount}
          variant={legendVariant}
        />
      </div>
    </div>
  )
}

function ExpenseAnalyzerVisuals({
  categoryBreakdown,
  overallSpending,
  recurringCharges,
  totalRecurringMonthly,
}) {
  const spending = prepareDonutSlices(categoryBreakdown)
  const recurring = prepareRecurringSlices(recurringCharges)

  if (!spending.slices.length) {
    return null
  }

  const showRecurring = recurring.slices.length > 0

  return (
    <section
      aria-label="Spending visuals"
      className="relative overflow-hidden rounded-2xl border border-[#1E2D45] bg-[#111827]"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#8B5CF6]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-[#10B981]/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Your spending at a glance</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">Last 30 days · by category</p>
          </div>

          {overallSpending?.delta && (
            <StatDeltaBadge delta={overallSpending.delta} statType="spending" inline />
          )}
        </div>

        <div className="mt-6">
          <VisualBlock
            slices={spending.slices}
            total={spending.total}
            centerSubLabel="Total spent"
            formatAmount={formatCurrency}
            ariaLabel="Category spending breakdown donut chart"
            showHeader={false}
          />
        </div>

        {showRecurring && (
          <div className="mt-8 border-t border-[#1E2D45] pt-7">
            <VisualBlock
              title="Recurring footprint"
              subtitle={`${formatCurrency(totalRecurringMonthly || recurring.total)}/mo across subscriptions`}
              slices={recurring.slices}
              total={totalRecurringMonthly || recurring.total}
              centerSubLabel="Per month"
              formatAmount={formatCurrency}
              formatCenterAmount={formatCurrency}
              ariaLabel="Recurring charges breakdown donut chart"
              size="compact"
              legendVariant="combined"
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default ExpenseAnalyzerVisuals
