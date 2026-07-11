/**
 * Client-side plan parser checks (run via node with experimental strip or duplicate logic).
 * Kept as a tiny mirror test in server for CI without a browser harness.
 */

import assert from 'node:assert/strict'

const PLAN_FENCE_RE = /```soverm-plan\s*([\s\S]*?)```/i

function splitAssistantContent(content) {
  const text = String(content || '')
  const match = text.match(PLAN_FENCE_RE)
  if (!match) {
    return { markdown: text, plan: null }
  }

  try {
    const parsed = JSON.parse(match[1].trim())
    const cards = Array.isArray(parsed?.cards)
      ? parsed.cards.filter((card) => card && (card.title || card.detail))
      : []
    if (cards.length === 0) {
      return { markdown: text, plan: null }
    }
    return {
      markdown: text.replace(match[0], '').trim(),
      plan: { title: parsed.title ?? null, cards },
    }
  } catch {
    return { markdown: text, plan: null }
  }
}

const sample = `Here's a lean night out plan.

\`\`\`soverm-plan
{"title":"Night out","cards":[{"title":"Lean","detail":"Drinks only","amount":"$25","tone":"fine"}]}
\`\`\`
`

const parsed = splitAssistantContent(sample)
assert.equal(parsed.plan.title, 'Night out')
assert.equal(parsed.plan.cards[0].title, 'Lean')
assert.match(parsed.markdown, /lean night out/i)
assert.equal(splitAssistantContent('Just markdown').plan, null)
assert.equal(splitAssistantContent('```soverm-plan\n{bad}\n```').plan, null)

console.log('parseSovermPlan mirror tests passed.')
