import { format } from 'date-fns'

/*
 * groupInsightsByMonth(insights)
 *
 * Groups a descending insight list into { key, label, insights } buckets
 * by calendar month — e.g. "July 2026".
 */
export function groupInsightsByMonth(insights) {
  const groups = []
  const indexByKey = new Map()

  for (const insight of insights) {
    const date = new Date(insight.created_at)

    if (Number.isNaN(date.getTime())) {
      continue
    }

    const key = format(date, 'yyyy-MM')
    const label = format(date, 'MMMM yyyy')

    if (!indexByKey.has(key)) {
      const group = { key, label, insights: [] }
      indexByKey.set(key, groups.length)
      groups.push(group)
    }

    groups[indexByKey.get(key)].insights.push(insight)
  }

  return groups
}
