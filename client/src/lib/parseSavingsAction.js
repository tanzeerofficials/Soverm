/*
 * Parse savings-style action text so the checklist can offer "Set as savings goal".
 *
 * Examples:
 * - "Save $200 toward an emergency fund"
 * - "Set aside 150 this month for travel"
 */

const MONEY_RE = /(?:\$\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/
const SAVE_RE = /\b(save|set aside|put aside|stash|reserve)\b/i

export function parseSavingsActionSuggestion(description) {
  const text = String(description ?? '').trim()
  if (!text || !SAVE_RE.test(text)) {
    return null
  }

  const match = text.match(MONEY_RE)
  if (!match) {
    return null
  }

  const monthlyAmount = Number(String(match[1]).replace(/,/g, ''))
  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 1) {
    return null
  }

  let purposeType = 'future'
  const lower = text.toLowerCase()
  if (/\bdebt|loan|credit card|pay off\b/.test(lower)) {
    purposeType = 'debt'
  } else if (/\bpurchase|buy|trip|travel|vacation|car|house|wedding\b/.test(lower)) {
    purposeType = 'purchase'
  }

  const name =
    text.length > 60 ? `${text.slice(0, 57).trim()}…` : text

  return {
    monthlyAmount,
    purposeType,
    name,
  }
}
