export const DELTA_VS_LABEL = 'vs prior 30 days'

function formatMoneyAmount(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return null
  }

  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function getDeltaDisplayParts(delta) {
  if (!delta || typeof delta !== 'object' || !delta.direction) {
    return null
  }

  return {
    direction: delta.direction,
    isNew:
      delta.direction === 'up' &&
      (delta.percent === null || delta.percent === undefined) &&
      delta.times == null,
    changeLabel: formatMoneyAmount(delta.absoluteChange),
    currentLabel: formatMoneyAmount(delta.currentTotal),
    priorLabel: formatMoneyAmount(delta.priorTotal),
    legacyPercent: delta.percent,
  }
}

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

  if (delta.direction === 'up' && (delta.percent === null || delta.percent === undefined) && delta.times == null) {
    return `New ${metricLabel.toLowerCase()} category ${DELTA_VS_LABEL}`
  }

  const currentLabel = formatMoneyAmount(delta.currentTotal)
  const priorLabel = formatMoneyAmount(delta.priorTotal)
  const changeLabel = formatMoneyAmount(delta.absoluteChange)
  const directionWord = delta.direction === 'up' ? 'up' : 'down'

  if (currentLabel && priorLabel) {
    return `${metricLabel} ${currentLabel} this period, ${directionWord} from ${priorLabel} in the prior 30 days`
  }

  if (changeLabel) {
    return `${metricLabel} ${directionWord} by ${changeLabel} ${DELTA_VS_LABEL}`
  }

  // Legacy insights that only stored percent.
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
    const changeLabel = formatMoneyAmount(delta.absoluteChange)
    const currentLabel = formatMoneyAmount(delta.currentTotal)
    const priorLabel = formatMoneyAmount(delta.priorTotal)

    if (delta.direction === 'up') {
      if (delta.percent == null && delta.times == null) {
        add(`Why is ${label} new this period?`)
      } else if (currentLabel && priorLabel) {
        add(`What changed in ${label} from ${priorLabel} before to ${currentLabel} this period?`)
      } else if (changeLabel) {
        add(`What contributed to the ${changeLabel} increase in ${label}?`)
      } else {
        add(`Why did ${label} go up ${delta.percent}%?`)
      }
    } else if (delta.direction === 'down') {
      if (currentLabel && priorLabel) {
        add(`What changed in ${label} from ${priorLabel} before to ${currentLabel} this period?`)
      } else if (changeLabel) {
        add(`What contributed to the ${changeLabel} decrease in ${label}?`)
      } else if (delta.percent != null) {
        add(`Why did ${label} go down ${delta.percent}%?`)
      }
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

  if (
    delta.direction === 'up' &&
    (delta.percent === null || delta.percent === undefined) &&
    delta.times == null
  ) {
    return 'new'
  }

  const changeLabel = formatMoneyAmount(delta.absoluteChange)
  const currentLabel = formatMoneyAmount(delta.currentTotal)
  const priorLabel = formatMoneyAmount(delta.priorTotal)
  const arrow = delta.direction === 'down' ? '↓' : '↑'

  if (currentLabel && priorLabel) {
    return `${arrow} ${currentLabel} · was ${priorLabel}`
  }

  if (changeLabel) {
    return `${arrow} ${delta.direction === 'down' ? '−' : '+'}${changeLabel}`
  }

  return delta.percent != null ? `${arrow} ${delta.percent}%` : null
}

export function compactDeltaToneClass(statType, delta) {
  if (!delta?.direction) {
    return 'text-fg-muted'
  }

  const isNew =
    delta.direction === 'up' &&
    (delta.percent === null || delta.percent === undefined) &&
    delta.times == null
  const tone = toneForChange(statType, delta.direction, isNew)

  if (tone === 'positive') {
    return 'text-brand-soft'
  }

  if (tone === 'negative') {
    return 'text-danger'
  }

  return 'text-fg-muted'
}
