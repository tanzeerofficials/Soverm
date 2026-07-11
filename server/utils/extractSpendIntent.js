/*
 * EXTRACT SPEND INTENT
 *
 * Pulls a dollar amount (and optional category) from a chat message so we can
 * run Before You Spend before Claude answers affordability questions.
 */

const SPEND_QUESTION =
  /\b(afford|spend|buy|purchase|splurge|treat myself|night\s+out|go\s+out|is\s+\$?\d|can\s+i\s+get|should\s+i\s+(get|buy|spend))\b/i

const AMOUNT_RE =
  /\$\s*(\d{1,6}(?:\.\d{1,2})?)|(?:^|[^\d.])(\d{1,6}(?:\.\d{1,2})?)\s*(?:dollars?|bucks)\b/i

const CATEGORY_HINTS = [
  { re: /\b(dining|dinner|lunch|brunch|restaurant|takeout|food|groceries|grocery)\b/i, category: 'Food and Drink' },
  { re: /\b(uber|lyft|taxi|transit|gas|fuel|parking)\b/i, category: 'Travel' },
  { re: /\b(movie|concert|ticket|entertainment|bar|drinks|nightlife)\b/i, category: 'Entertainment' },
  { re: /\b(clothes|clothing|shoes|shopping|amazon)\b/i, category: 'Shopping' },
  { re: /\b(rent|mortgage|housing)\b/i, category: 'Rent' },
]

/**
 * @param {string} message
 * @returns {{ amount: number, category: string | null } | null}
 */
export function extractSpendIntent(message) {
  const text = String(message || '').trim()
  if (!text || !SPEND_QUESTION.test(text)) {
    return null
  }

  const amountMatch = text.match(AMOUNT_RE)
  if (!amountMatch) {
    return null
  }

  const amount = Number(amountMatch[1] ?? amountMatch[2])
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return null
  }

  let category = null
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(text)) {
      category = hint.category
      break
    }
  }

  return { amount, category }
}
