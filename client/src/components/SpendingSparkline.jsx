import { useId } from 'react'
import { buildSparklineGeometry, formatSparklineTotal } from '../lib/spendingSparkline.js'
import { formatCurrency } from '../lib/formatCurrency.js'

function SpendingSparkline({ series = [], className = '' }) {
  const gradientId = useId()
  const values = series.map((point) => point.amount)
  const geometry = buildSparklineGeometry(values)
  const total = formatSparklineTotal(values)
  const totalLabel = formatCurrency(total, { maximumFractionDigits: 0 })

  if (!geometry || values.every((value) => value === 0)) {
    return (
      <div
        className={`rounded-xl border border-border-default/80 bg-app/40 px-4 py-6 text-center ${className}`}
      >
        <p className="text-xs text-fg-subtle">No spending in this period yet</p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-border-default/80 bg-app/40 px-4 py-3 ${className}`}
      aria-label={`Daily spending trend, ${totalLabel} total in this period`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
          Daily spending
        </p>
        <p className="font-mono text-xs tabular-nums text-fg-muted">{totalLabel} total</p>
      </div>

      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className="mx-auto h-[4.5rem] w-full max-w-[18rem]"
        preserveAspectRatio="none"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ai)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-ai)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={geometry.area} fill={`url(#${gradientId})`} />
        <polyline
          points={geometry.line}
          fill="none"
          stroke="var(--color-ai-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {geometry.coords.length > 0 && (
          <circle
            cx={geometry.coords[geometry.coords.length - 1].x}
            cy={geometry.coords[geometry.coords.length - 1].y}
            r="3.5"
            fill="var(--color-ai-soft)"
            stroke="var(--color-app)"
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  )
}

export default SpendingSparkline
