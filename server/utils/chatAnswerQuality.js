/*
 * CHAT ANSWER QUALITY
 *
 * Pure helpers that score an Ask Soverm reply against a fixture:
 * - cites real dollars / merchants from context
 * - includes a concrete next step
 * - does not invent merchants that were never in the data
 *
 * Used by live Claude tests and offline unit checks.
 */

const NEXT_STEP_RE =
  /\b(next step|do this|today|this week|cancel|downgrade|set (a |your )?|open |tap |go to |start by|try |skip |cook |wait until payday|pay yourself)\b/i

/**
 * Normalize money mentions so "$89.40", "$89.4", "89.40", and "$1,072.80" can
 * match a fixture amount.
 */
export function moneyMentionPatterns(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) {
    return []
  }

  const fixed2 = n.toFixed(2)
  const fixed1 = n.toFixed(1)
  const asInt = Number.isInteger(n) ? String(n) : null
  const withComma2 = fixed2.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const withCommaWhole = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const variants = new Set([
    fixed2,
    fixed1,
    String(n),
    withComma2,
    withCommaWhole,
    `$${fixed2}`,
    `$${fixed1}`,
    `$${n}`,
    `$${withComma2}`,
    `$${withCommaWhole}`,
  ])
  if (asInt) {
    variants.add(asInt)
    variants.add(`$${asInt}`)
  }

  return [...variants].map((value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
}

function normalizeMoneyText(text) {
  // Strip thousands separators so "$1,072.80" matches patterns for 1072.8
  return String(text || '').replace(/(\d),(\d{3})/g, '$1$2')
}

export function replyCitesAmount(reply, amount) {
  const text = String(reply || '')
  const normalized = normalizeMoneyText(text)
  return moneyMentionPatterns(amount).some((pattern) => {
    const re = new RegExp(pattern)
    return re.test(text) || re.test(normalized)
  })
}

export function replyCitesMerchant(reply, merchant) {
  if (!merchant) {
    return false
  }
  const escaped = String(merchant).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(String(reply || ''))
}

export function replyHasNextStep(reply) {
  return NEXT_STEP_RE.test(String(reply || ''))
}

const GENERIC_CLOSING_QUESTION_RE =
  /\b(what do you think|does that help|let me know if you (have any )?questions|want me to explain further|anything else I can help|hope that helps)\b/i

/**
 * Last non-empty line of a reply — used to inspect engagement hooks.
 */
export function getReplyClosingLine(reply) {
  const lines = String(reply || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines[lines.length - 1] ?? ''
}

/**
 * True when the reply ends with a question mark (engagement hook or clarifying Q).
 */
export function replyEndsWithQuestion(reply) {
  return /\?\s*$/.test(getReplyClosingLine(reply))
}

/**
 * True when the closing line looks like a banned generic filler CTA.
 */
export function replyHasGenericClosingQuestion(reply) {
  if (!replyEndsWithQuestion(reply)) {
    return false
  }
  return GENERIC_CLOSING_QUESTION_RE.test(getReplyClosingLine(reply))
}

/**
 * Normalize a closing question for "same hook twice" comparisons.
 */
export function normalizeClosingQuestion(reply) {
  return getReplyClosingLine(reply)
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find banned merchants that appear in the reply (case-insensitive whole word).
 */
export function findInventedMerchants(reply, bannedMerchants = []) {
  const text = String(reply || '')
  return bannedMerchants.filter((merchant) => replyCitesMerchant(text, merchant))
}

/**
 * Score a chat reply for fixture-grounded quality.
 *
 * @returns {{
 *   ok: boolean,
 *   citesRequiredAmounts: boolean,
 *   citesRequiredMerchants: boolean,
 *   hasNextStep: boolean,
 *   inventedMerchants: string[],
 *   missingAmounts: number[],
 *   missingMerchants: string[],
 *   failures: string[],
 * }}
 */
export function scoreChatAnswer(
  reply,
  {
    requiredAmounts = [],
    requiredMerchants = [],
    bannedMerchants = [],
    requireNextStep = true,
  } = {}
) {
  const missingAmounts = requiredAmounts.filter(
    (amount) => !replyCitesAmount(reply, amount)
  )
  const missingMerchants = requiredMerchants.filter(
    (merchant) => !replyCitesMerchant(reply, merchant)
  )
  const inventedMerchants = findInventedMerchants(reply, bannedMerchants)
  const hasNextStep = requireNextStep ? replyHasNextStep(reply) : true

  const failures = []
  if (missingAmounts.length) {
    failures.push(
      `missing dollar cite(s): ${missingAmounts.map((a) => `$${a}`).join(', ')}`
    )
  }
  if (missingMerchants.length) {
    failures.push(`missing merchant cite(s): ${missingMerchants.join(', ')}`)
  }
  if (!hasNextStep) {
    failures.push('no concrete next step detected')
  }
  if (inventedMerchants.length) {
    failures.push(`invented merchant(s): ${inventedMerchants.join(', ')}`)
  }

  return {
    ok: failures.length === 0,
    citesRequiredAmounts: missingAmounts.length === 0,
    citesRequiredMerchants: missingMerchants.length === 0,
    hasNextStep,
    inventedMerchants,
    missingAmounts,
    missingMerchants,
    failures,
  }
}

/**
 * Merchants a grounded reply should never invent for the standard fixture
 * (none of these appear in buildAnswerQualityFixture).
 */
export const DEFAULT_BANNED_MERCHANTS = [
  'Netflix',
  'Spotify',
  'Hulu',
  'Disney+',
  'Disney Plus',
  'Amazon Prime',
  'Apple Music',
  'YouTube Premium',
  'Costco',
  'Walmart',
]
