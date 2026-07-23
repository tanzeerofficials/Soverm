/*
 * CATEGORY TREND CHART
 *
 * Compact 3-month bar trend shown inside a category's drill-down — is this
 * category rising, flat, or falling, at a glance, before the merchant list.
 */

import { buildCategoryTrendGeometry } from '../lib/categoryTrendChart.js'
import { formatCurrency } from '../lib/formatCurrency.js'

function CategoryTrendChart({ months = [], className = '' }) {
  const hasData = months.some((month) => (month.total ?? 0) > 0)
  if (!hasData) {
    return null
  }

  const geometry = buildCategoryTrendGeometry(months)
  if (!geometry) {
    return null
  }

  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
        3-month trend
      </p>
      <div className="mt-2 flex items-end gap-3">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="h-10 w-24 shrink-0"
          preserveAspectRatio="none"
          role="img"
          aria-label={months
            .map((m) => `${m.monthLabel}: ${formatCurrency(m.total)}`)
            .join('. ')}
        >
          {geometry.bars.map((bar) => (
            <rect
              key={bar.monthKey}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx="2"
              fill={bar.isLast ? 'var(--color-ai-soft)' : 'var(--color-border-hover)'}
            />
          ))}
        </svg>
        <ul className="flex-1 space-y-0.5 text-[11px] text-fg-subtle">
          {months.map((month) => (
            <li key={month.monthKey} className="flex justify-between gap-3">
              <span>{month.monthLabel}</span>
              <span className="font-mono tabular-nums">{formatCurrency(month.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default CategoryTrendChart
