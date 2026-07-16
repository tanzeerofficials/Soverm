const RANGE_DAY_COUNTS = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '1y': 365,
}

/*
 * Format a Date as YYYY-MM-DD in local calendar time.
 * Avoids toISOString() which shifts the day near UTC midnight for US timezones
 * and can make the sparkline total disagree with Cash Flow Spend.
 */
function toLocalDateKey(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDateMap(sparseSeries = []) {
  const byDate = new Map()

  for (const row of sparseSeries) {
    const key = toLocalDateKey(row.date)

    if (key) {
      byDate.set(key, Number(row.amount) || 0)
    }
  }

  return byDate
}

/*
 * fillSpendingSeries(sparseSeries, range)
 *
 * Turns sparse daily totals from the API into a fixed-length series with
 * zero-filled gaps so the sparkline renders a continuous shape.
 * `mtd` fills from the 1st of this month through today.
 */
export function fillSpendingSeries(sparseSeries = [], range = '30d') {
  const byDate = buildDateMap(sparseSeries)
  const end = new Date()
  end.setHours(12, 0, 0, 0)

  const result = []

  if (range === 'mtd') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1, 12, 0, 0, 0)
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = toLocalDateKey(cursor)
      result.push({
        date: key,
        amount: byDate.get(key) ?? 0,
      })
    }
    return result
  }

  const dayCount = RANGE_DAY_COUNTS[range] ?? RANGE_DAY_COUNTS['30d']

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(end)
    day.setDate(day.getDate() - offset)
    const key = toLocalDateKey(day)

    result.push({
      date: key,
      amount: byDate.get(key) ?? 0,
    })
  }

  return result
}

export function buildSparklineGeometry(
  values,
  { width = 280, height = 72, padding = 6 } = {}
) {
  if (!values.length) {
    return null
  }

  const max = Math.max(...values, 1)
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const coords = values.map((value, index) => {
    const x =
      padding +
      (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
    const y = padding + innerHeight - (value / max) * innerHeight

    return { x, y }
  })

  const line = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const area = [
    `${coords[0].x},${height - padding}`,
    ...coords.map((point) => `${point.x},${point.y}`),
    `${coords[coords.length - 1].x},${height - padding}`,
  ].join(' ')

  return { coords, line, area, max, width, height }
}

export function formatSparklineTotal(values) {
  return values.reduce((sum, value) => sum + value, 0)
}
