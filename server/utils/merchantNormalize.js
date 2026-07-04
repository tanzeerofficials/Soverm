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

function canonicalizeGroupingKey(tokens, rawName) {
  const lower = rawName.toLowerCase()

  if (lower.includes('replit')) {
    return 'replit inc replit com'
  }

  if (
    lower.includes('claude') &&
    (lower.includes('subscription') || /\bsub\b/.test(lower))
  ) {
    return 'claude ai subscription anthropic'
  }

  if (lower.includes('anthropic') && !lower.includes('claude') && !lower.includes('subscription')) {
    return 'anthropic anthropic comca'
  }

  const brand = resolveSubscriptionMerchantKeyword(rawName)
  if (brand && tokens.length <= 3) {
    return brand
  }

  return tokens.join(' ') || 'unknown'
}

const GROUPING_DISPLAY_LABELS = {
  'replit inc replit com': 'Replit',
  'claude ai subscription anthropic': 'Claude.ai Subscription',
  'anthropic anthropic comca': 'Anthropic',
}

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
