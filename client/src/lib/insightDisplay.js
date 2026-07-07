export const DELTA_VS_LABEL = 'vs prior 30 days'

export function normalizePeriodCopy(text) {
  if (!text || typeof text !== 'string') {
    return text
  }

  return text
    .replace(/\bvs\.?\s*last month\b/gi, DELTA_VS_LABEL)
    .replace(/\bversus last month\b/gi, 'versus the prior 30 days')
    .replace(/\bfrom last month\b/gi, 'from the prior 30 days')
}

export function resolveStatType(stat) {
  if (stat.statType === 'income' || stat.statType === 'spending' || stat.statType === 'neutral') {
    return stat.statType
  }

  const text = [stat.label, stat.detail, stat.value]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/\b(income|earned|deposit|salary|paycheck|wages|revenue|pay)\b/.test(text)) {
    return 'income'
  }

  if (/\b(cash|liquid|balance|savings|checking|debt|credit|utilization)\b/.test(text)) {
    return 'neutral'
  }

  return 'spending'
}

export function toneForChange(statType, direction, isNew = false) {
  if (statType === 'neutral') {
    return 'neutral'
  }

  if (isNew) {
    return statType === 'income' ? 'positive' : 'negative'
  }

  if (direction === 'flat') {
    return 'neutral'
  }

  const isPositive = statType === 'income' ? direction === 'up' : direction === 'down'

  return isPositive ? 'positive' : 'negative'
}

export function buildDeltaAriaLabel(delta, statType = 'spending') {
  if (!delta || typeof delta !== 'object' || !delta.direction) {
    return undefined
  }

  const metricLabel =
    statType === 'income' ? 'Income' : statType === 'neutral' ? 'Balance' : 'Spending'

  if (delta.direction === 'flat') {
    return `${metricLabel} unchanged ${DELTA_VS_LABEL}`
  }

  if (delta.direction === 'up' && (delta.percent === null || delta.percent === undefined)) {
    return `New ${metricLabel.toLowerCase()} category ${DELTA_VS_LABEL}`
  }

  const directionWord = delta.direction === 'up' ? 'up' : 'down'

  return `${metricLabel} ${directionWord} ${delta.percent}% ${DELTA_VS_LABEL}`
}

export function formatInsightSnapshotFootnote(insight) {
  if (!insight) {
    return null
  }

  const metadata = insight.metadata
  const generatedAt = metadata?.generatedAt ?? insight.created_at

  if (!generatedAt) {
    return null
  }

  const date = generatedAt instanceof Date ? generatedAt : new Date(generatedAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const formattedDate = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const parts = []

  if (typeof metadata?.transactionCount === 'number') {
    const count = metadata.transactionCount
    parts.push(`Based on ${count} transaction${count === 1 ? '' : 's'}`)
  }

  if (metadata?.comparisonWindow === '30d') {
    parts.push('rolling 30-day window')
  }

  parts.push(formattedDate)

  return parts.join(' · ')
}

export function buildQuickQuestions(insight) {
  const questions = []
  const seen = new Set()

  function add(question) {
    if (!question || seen.has(question) || questions.length >= 3) {
      return
    }

    seen.add(question)
    questions.push(question)
  }

  for (const stat of insight?.stats ?? []) {
    const delta = stat.delta
    if (!delta?.direction || delta.direction === 'flat') {
      continue
    }

    const label = String(stat.label ?? 'this category').toLowerCase()

    if (delta.direction === 'up') {
      if (delta.percent == null) {
        add(`Why is ${label} new this period?`)
      } else {
        add(`Why did ${label} go up ${delta.percent}%?`)
      }
    } else if (delta.direction === 'down' && delta.percent != null) {
      add(`Why did ${label} go down ${delta.percent}%?`)
    }
  }

  let dollarAmount = null
  for (const stat of insight?.stats ?? []) {
    const match = String(stat.value ?? '').match(/\$[\d,]+(?:\.\d{2})?/)
    if (match) {
      dollarAmount = match[0]
      break
    }
  }

  add('Which one should I prioritize?')
  add(
    dollarAmount
      ? `What if I only had ${dollarAmount} to work with?`
      : 'What if I only had limited funds to work with?'
  )
  add('Explain this in simpler terms')

  return questions.slice(0, 3)
}

export function selectHistoryPreviewStats(stats, limit = 2) {
  const list = Array.isArray(stats) ? stats : []

  if (list.length === 0) {
    return []
  }

  const withDelta = list.filter((stat) => stat.delta?.direction)
  const withoutDelta = list.filter((stat) => !stat.delta?.direction)

  return [...withDelta, ...withoutDelta].slice(0, limit)
}

export function formatCompactDelta(delta) {
  if (!delta || typeof delta !== 'object' || !delta.direction) {
    return null
  }

  if (delta.direction === 'flat') {
    return 'steady'
  }

  if (delta.direction === 'up' && (delta.percent === null || delta.percent === undefined)) {
    return 'new'
  }

  if (delta.direction === 'up') {
    return `↑ ${delta.percent}%`
  }

  if (delta.direction === 'down') {
    return `↓ ${delta.percent}%`
  }

  return null
}

export function compactDeltaToneClass(statType, delta) {
  if (!delta?.direction) {
    return 'text-fg-muted'
  }

  const isNew = delta.direction === 'up' && (delta.percent === null || delta.percent === undefined)
  const tone = toneForChange(statType, delta.direction, isNew)

  if (tone === 'positive') {
    return 'text-emerald-400'
  }

  if (tone === 'negative') {
    return 'text-red-400'
  }

  return 'text-fg-muted'
}
