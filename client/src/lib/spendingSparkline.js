const RANGE_DAY_COUNTS = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '1y': 365,
}

function toDateKey(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

/*
 * fillSpendingSeries(sparseSeries, range)
 *
 * Turns sparse daily totals from the API into a fixed-length series with
 * zero-filled gaps so the sparkline renders a continuous shape.
 */
export function fillSpendingSeries(sparseSeries = [], range = '30d') {
  const dayCount = RANGE_DAY_COUNTS[range] ?? RANGE_DAY_COUNTS['30d']
  const byDate = new Map()

  for (const row of sparseSeries) {
    const key = toDateKey(row.date)

    if (key) {
      byDate.set(key, Number(row.amount) || 0)
    }
  }

  const end = new Date()
  end.setHours(12, 0, 0, 0)

  const result = []

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(end)
    day.setDate(day.getDate() - offset)
    const key = day.toISOString().slice(0, 10)

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
