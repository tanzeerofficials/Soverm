const MERCHANT_SUFFIX_WORDS = new Set([
  'usa',
  'us',
  'inc',
  'llc',
  'ltd',
  'co',
  'corp',
  'premium',
  'subscription',
  'sub',
  'online',
  'digital',
])

/**
 * Collapses merchant name variants (e.g. "SPOTIFY USA", "SPOTIFY*PREMIUM") into one key.
 */
export function normalizeMerchantName(name) {
  if (!name || typeof name !== 'string') {
    return 'unknown'
  }

  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) {
    return 'unknown'
  }

  const significant = tokens.filter((token) => !MERCHANT_SUFFIX_WORDS.has(token))
  const chosen = (significant.length > 0 ? significant : tokens).slice(0, 2)

  return chosen.join(' ')
}
