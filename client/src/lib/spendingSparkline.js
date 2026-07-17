const RANGE_DAY_COUNTS = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '1y': 365,
}

/*
 * Format a Date as YYYY-MM-DD in local calendar time.
 * Prefer server-provided todayIso / periodStart for MTD so the sparkline
 * matches Cash Flow (app timezone), not the browser's local midnight.
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

function addDaysIso(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function eachIsoDayInclusive(startIso, endIso) {
  const days = []
  for (let cursor = startIso; cursor <= endIso; cursor = addDaysIso(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

/*
 * fillSpendingSeries(sparseSeries, range, options?)
 *
 * Turns sparse daily totals from the API into a fixed-length series with
 * zero-filled gaps so the sparkline renders a continuous shape.
 * `mtd` fills from periodStart (or 1st of month) through todayIso (or local today).
 */
export function fillSpendingSeries(sparseSeries = [], range = '30d', options = {}) {
  const byDate = buildDateMap(sparseSeries)
  const todayIso =
    typeof options.todayIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(options.todayIso)
      ? options.todayIso.slice(0, 10)
      : toLocalDateKey(new Date())

  const result = []

  if (range === 'mtd') {
    const startIso =
      typeof options.periodStart === 'string' && /^\d{4}-\d{2}-\d{2}/.test(options.periodStart)
        ? options.periodStart.slice(0, 10)
        : `${todayIso.slice(0, 8)}01`

    for (const key of eachIsoDayInclusive(startIso, todayIso)) {
      result.push({
        date: key,
        amount: byDate.get(key) ?? 0,
      })
    }
    return result
  }

  const dayCount = RANGE_DAY_COUNTS[range] ?? RANGE_DAY_COUNTS['30d']

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const key = addDaysIso(todayIso, -offset)
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
