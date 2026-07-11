/*
 * PARSE SOVERM PLAN BLOCK
 *
 * Assistant replies can optionally end with a fenced ```soverm-plan JSON block.
 * We strip it for markdown rendering and turn cards into a structured UI.
 * Invalid JSON falls back to showing the full message as markdown.
 */

const PLAN_FENCE_RE = /```soverm-plan\s*([\s\S]*?)```/i

/**
 * @param {string} content
 * @returns {{ markdown: string, plan: { title?: string, summary?: string, cards?: array } | null }}
 */
export function splitAssistantContent(content) {
  const text = String(content || '')
  const match = text.match(PLAN_FENCE_RE)
  if (!match) {
    return { markdown: text, plan: null }
  }

  try {
    const parsed = JSON.parse(match[1].trim())
    const cards = Array.isArray(parsed?.cards)
      ? parsed.cards
          .filter((card) => card && (card.title || card.detail))
          .slice(0, 8)
          .map((card) => ({
            title: String(card.title || '').trim(),
            detail: String(card.detail || '').trim(),
            tone: normalizeTone(card.tone),
            amount: card.amount != null ? String(card.amount) : null,
            label: card.label != null ? String(card.label) : null,
          }))
      : []

    if (cards.length === 0) {
      return { markdown: text, plan: null }
    }

    const markdown = text.replace(match[0], '').trim()
    return {
      markdown,
      plan: {
        title: parsed.title ? String(parsed.title) : null,
        summary: parsed.summary ? String(parsed.summary) : null,
        cards,
      },
    }
  } catch {
    return { markdown: text, plan: null }
  }
}

function normalizeTone(tone) {
  const value = String(tone || '').toLowerCase()
  if (['fine', 'good', 'success'].includes(value)) return 'fine'
  if (['warning', 'caution'].includes(value)) return 'warning'
  if (['danger', 'risk', 'bad'].includes(value)) return 'danger'
  return 'neutral'
}

/**
 * Plain-text version of a soverm-plan for clipboard / share.
 */
export function formatSovermPlanText(plan) {
  if (!plan?.cards?.length) {
    return ''
  }

  const lines = []
  if (plan.title) {
    lines.push(plan.title)
  }
  if (plan.summary) {
    lines.push(plan.summary)
  }
  if (lines.length) {
    lines.push('')
  }

  plan.cards.forEach((card, index) => {
    const bits = [`${index + 1}. ${card.title || 'Step'}`]
    if (card.amount) {
      bits.push(`(${card.amount}${card.label ? ` · ${card.label}` : ''})`)
    } else if (card.label) {
      bits.push(`(${card.label})`)
    }
    lines.push(bits.join(' '))
    if (card.detail) {
      lines.push(`   ${card.detail}`)
    }
  })

  return lines.join('\n').trim()
}

/**
 * Copyable text for an assistant bubble: markdown prose + plan checklist.
 */
export function formatAssistantShareText(content) {
  const { markdown, plan } = splitAssistantContent(content)
  const planText = formatSovermPlanText(plan)
  if (markdown && planText) {
    return `${markdown.trim()}\n\n${planText}`
  }
  return (markdown || planText || String(content || '')).trim()
}

export async function copyTextToClipboard(text) {
  const value = String(text || '')
  if (!value) {
    throw new Error('Nothing to copy')
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  // Fallback for older mobile browsers
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('Copy failed')
  }
}
