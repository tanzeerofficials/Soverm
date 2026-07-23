import { resolveSubscriptionMerchantKeyword } from './recurringChargeFilters.js'

const LEADING_DESCRIPTOR_WORDS = new Set([
  'purchase',
  'checkcard',
  'debit',
  'pos',
])

const US_STATE_CODES = new Set(['ca', 'ny', 'tx', 'fl', 'wa', 'il', 'pa', 'oh', 'ga', 'nc'])

function tokenizeMerchantName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function isStrippedNoiseToken(token) {
  if (!token) {
    return true
  }

  if (LEADING_DESCRIPTOR_WORDS.has(token)) {
    return true
  }

  if (/^\d{4}$/.test(token)) {
    return true
  }

  if (/^x{4,}\d*$/i.test(token) || (token.length >= 10 && /x/i.test(token) && /\d/.test(token))) {
    return true
  }

  if (token === 'recurring') {
    return true
  }

  if (US_STATE_CODES.has(token)) {
    return true
  }

  return false
}

function stripBankDescriptorTokens(name) {
  return tokenizeMerchantName(name).filter((token) => !isStrippedNoiseToken(token))
}

/*
 * Merchants whose raw bank descriptors are too inconsistent for the generic
 * tokenizer to group reliably (see normalizeMerchantName below), so they get
 * an explicit match rule instead. To add one: append an entry here — no
 * other code in this file needs to change. `match` runs against the
 * lowercased raw name; entries are checked in order, first match wins.
 */
const MERCHANT_ALIASES = [
  {
    match: (lower) => lower.includes('replit'),
    canonicalKey: 'replit inc replit com',
    displayLabel: 'Replit',
  },
  {
    // Anthropic bills two products under overlapping descriptors: the
    // Claude.ai subscription and pay-as-you-go API usage. Only the
    // subscription (flagged by "subscription" or a standalone "sub") should
    // group under this key — API usage falls through to the next rule below.
    match: (lower) =>
      lower.includes('claude') && (lower.includes('subscription') || /\bsub\b/.test(lower)),
    canonicalKey: 'claude ai subscription anthropic',
    displayLabel: 'Claude.ai Subscription',
  },
  {
    // Anthropic API usage: "anthropic" without "claude" or "subscription" —
    // deliberately excludes the Claude.ai subscription rule above so the
    // two Anthropic products never merge into one recurring charge.
    match: (lower) =>
      lower.includes('anthropic') && !lower.includes('claude') && !lower.includes('subscription'),
    canonicalKey: 'anthropic anthropic comca',
    displayLabel: 'Anthropic',
  },
]

function findMerchantAlias(lower) {
  return MERCHANT_ALIASES.find((alias) => alias.match(lower))
}

function canonicalizeGroupingKey(tokens, rawName) {
  const lower = rawName.toLowerCase()

  const alias = findMerchantAlias(lower)
  if (alias) {
    return alias.canonicalKey
  }

  const brand = resolveSubscriptionMerchantKeyword(rawName)
  if (brand && tokens.length <= 3) {
    return brand
  }

  return tokens.join(' ') || 'unknown'
}

// Derived from MERCHANT_ALIASES so the canonical key can never drift out of
// sync between the matcher above and the label shown here.
const GROUPING_DISPLAY_LABELS = Object.fromEntries(
  MERCHANT_ALIASES.map((alias) => [alias.canonicalKey, alias.displayLabel])
)

/**
 * Strips bank-descriptor noise and returns a stable grouping key for recurring detection.
 * PURCHASE/CHECKCARD prefixes, MMDD codes, masked card numbers, RECURRING, and standalone
 * state codes are removed; merchant tokens like INC and COM are kept.
 */
export function normalizeMerchantName(name) {
  if (!name || typeof name !== 'string') {
    return 'unknown'
  }

  const stripped = stripBankDescriptorTokens(name)
  return canonicalizeGroupingKey(stripped, name)
}

export function stripBankDescriptor(name) {
  return stripBankDescriptorTokens(name).join(' ')
}

export function formatSubscriptionMerchantLabel(keyword) {
  if (!keyword) {
    return null
  }

  return keyword
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatMerchantDisplayLabel(groupingKey, rawName = '') {
  if (GROUPING_DISPLAY_LABELS[groupingKey]) {
    return GROUPING_DISPLAY_LABELS[groupingKey]
  }

  const brand = resolveSubscriptionMerchantKeyword(rawName || groupingKey)
  if (brand) {
    return formatSubscriptionMerchantLabel(brand)
  }

  if (!groupingKey || groupingKey === 'unknown') {
    return rawName || 'Unknown merchant'
  }

  return groupingKey
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
