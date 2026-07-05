/*
 * SVG donut — part-to-whole spending without chart-library chrome.
 */

import { useId } from 'react'
import { buildArcSegments, describeDonutSegment } from '../../lib/spendingVisualUtils.js'

const SIZE = 200
const OUTER_RADIUS = 88
const INNER_RADIUS = 62

function DonutChart({
  slices,
  centerLabel,
  centerSubLabel,
  ariaLabel,
  size = 'default',
  activeKey = null,
  onSegmentHover,
}) {
  const gradientId = useId()
  const segments = buildArcSegments(slices)
  const isCompact = size === 'compact'
  const chartSize = isCompact ? 140 : SIZE
  const scale = chartSize / SIZE
  const outerRadius = OUTER_RADIUS * scale
  const innerRadius = INNER_RADIUS * scale
  const center = chartSize / 2

  if (!segments.length) {
    return null
  }

  return (
    <div className="relative mx-auto shrink-0" style={{ width: chartSize, height: chartSize }}>
      <svg
        width={chartSize}
        height={chartSize}
        viewBox={`0 0 ${chartSize} ${chartSize}`}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1A2236" />
            <stop offset="100%" stopColor="#0A0F1C" />
          </radialGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill={`url(#${gradientId})`}
          opacity="0.9"
        />

        {segments.map((segment) => {
          const isActive = activeKey === segment.key
          const isDimmed = activeKey != null && !isActive

          return (
            <path
              key={segment.key}
              d={describeDonutSegment(
                center,
                center,
                innerRadius,
                outerRadius,
                segment.startAngle,
                segment.endAngle
              )}
              fill={segment.color}
              opacity={isDimmed ? 0.35 : isActive ? 1 : 0.92}
              className="transition-opacity duration-200"
              onMouseEnter={() => onSegmentHover?.(segment.key)}
              onMouseLeave={() => onSegmentHover?.(null)}
            />
          )
        })}

        <circle cx={center} cy={center} r={innerRadius - 2 * scale} fill="#111827" />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        {centerSubLabel && (
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">
            {centerSubLabel}
          </p>
        )}
        {centerLabel && (
          <p
            className={`font-mono font-bold tabular-nums text-[#F9FAFB] ${
              isCompact ? 'text-sm leading-tight' : 'text-2xl'
            }`}
          >
            {centerLabel}
          </p>
        )}
      </div>
    </div>
  )
}

export default DonutChart
