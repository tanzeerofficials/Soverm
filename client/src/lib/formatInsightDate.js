import { format } from 'date-fns'

export function formatInsightDate(createdAt) {
  if (!createdAt) return null
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return format(date, 'MMMM d, yyyy')
}
