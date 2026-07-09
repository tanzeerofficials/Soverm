/*
 * CASH FLOW FORECAST — client display helpers
 *
 * Mirrors server projection summaries for labels and sparkline geometry.
 */

export const FORECAST_HORIZON_DAYS = 30

export function formatForecastDate(isoDate) {
  if (!isoDate) {
    return '—'
  }

  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function buildForecastSparkline(points = [], { width = 280, height = 72, padding = 6 } = {}) {
  if (!points.length) {
    return { path: '', areaPath: '', minBalance: 0, maxBalance: 0 }
  }

  const balances = points.map((point) => point.balance)
  const minBalance = Math.min(...balances)
  const maxBalance = Math.max(...balances)
  const range = maxBalance - minBalance || 1
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * innerWidth
    const y = padding + innerHeight - ((point.balance - minBalance) / range) * innerHeight
    return { x, y }
  })

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${path} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${coordinates[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`

  return { path, areaPath, minBalance, maxBalance }
}

export function toneStyles(tone) {
  switch (tone) {
    case 'danger':
      return {
        border: 'border-danger/30 bg-danger/5',
        text: 'text-danger',
        chartStroke: 'stroke-danger',
        chartFill: 'fill-danger/15',
      }
    case 'warning':
      return {
        border: 'border-warning/30 bg-warning/5',
        text: 'text-warning',
        chartStroke: 'stroke-warning',
        chartFill: 'fill-warning/15',
      }
    default:
      return {
        border: 'border-brand/25 bg-brand/5',
        text: 'text-brand-soft',
        chartStroke: 'stroke-brand',
        chartFill: 'fill-brand/10',
      }
  }
}
