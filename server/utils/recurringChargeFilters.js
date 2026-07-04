const EXCLUDED_NAME_PATTERNS = [
  /\bpayment\b/i,
  /\bautopay\b/i,
  /\bauto pay\b/i,
  /\btransfer\b/i,
  /\bcredit card\b/i,
  /\bloan payment\b/i,
  /\bmortgage\b/i,
  /\batm\b/i,
  /\bcheck\b/i,
  /\bwithdrawal\b/i,
  /\bpmt\b/i,
  /\bill pay\b/i,
  /\bbillpay\b/i,
  /\bcard payment\b/i,
]

const HARD_EXCLUDED_NAME_FRAGMENTS = [
  'CREDIT CARD',
  'PAYMENT *//',
  'AUTOPAY',
  'AUTO PAY',
  'TRANSFER',
  'ATM',
  'WITHDRAWAL',
  'BILL PAY',
  'BILLPAY',
]

const EXCLUDED_CATEGORY_KEYWORDS = [
  'payment',
  'transfer',
  'credit card',
  'bank fee',
  'interest',
  'loan',
  'mortgage',
  'withdrawal',
  'check',
]

const SUBSCRIPTION_MERCHANT_KEYWORDS = [
  'spotify',
  'netflix',
  'hulu',
  'disney',
  'gym',
  'membership',
  'subscription',
  'subscr',
  'premium',
  'adobe',
  'microsoft 365',
  'office 365',
  'icloud',
  'youtube',
  'amazon prime',
  'audible',
  'dropbox',
  'notion',
  'slack',
  'planet fitness',
  'peloton',
  'classpass',
  'prime video',
]

const COINCIDENTAL_MERCHANT_FRAGMENTS = [
  'MCDONALD',
  'UBER',
  'LYFT',
  'STARBUCKS',
  'DOORDASH',
  'DOOR DASH',
  'GRUBHUB',
  'POSTMATES',
  'CHIPOTLE',
  'WENDY',
  'BURGER KING',
  'TACO BELL',
  'DUNKIN',
  'PANERA',
  'SUBWAY',
  'DOMINO',
  'PIZZA HUT',
  'WALGREENS',
  'CVS',
  'TARGET',
  'WALMART',
  'AMAZON MKT',
  'AMAZON MARKETPLACE',
]

const NOISY_CATEGORY_KEYWORDS = [
  'food and drink',
  'food',
  'restaurants',
  'transportation',
  'travel',
  'taxi',
  'ride share',
  'rideshare',
  'shops',
  'shopping',
  'groceries',
  'gas stations',
  'general merchandise',
]

const SUBSCRIPTION_LIKELY_CATEGORY_KEYWORDS = [
  'service',
  'recreation',
  'software',
  'subscription',
  'gyms and fitness',
  'health',
  'personal care',
]

export function normalizeCategoryLabel(category) {
  return (category || '').trim().toLowerCase()
}

export function isHardExcludedPaymentName(name) {
  if (!name || typeof name !== 'string') {
    return false
  }

  const upper = name.toUpperCase()

  if (upper.includes('CREDIT CARD') && upper.includes('PAYMENT')) {
    return true
  }

  return HARD_EXCLUDED_NAME_FRAGMENTS.some((fragment) => upper.includes(fragment))
}

export function matchesExcludedRecurringName(name) {
  if (isHardExcludedPaymentName(name)) {
    return true
  }

  if (!name || typeof name !== 'string') {
    return false
  }

  return EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(name))
}

export function matchesExcludedRecurringCategory(category) {
  const normalized = normalizeCategoryLabel(category)

  if (!normalized) {
    return false
  }

  return EXCLUDED_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function isExcludedFromRecurringDetection(row) {
  if (!row) {
    return true
  }

  return (
    matchesExcludedRecurringName(row.name) ||
    matchesExcludedRecurringCategory(row.category)
  )
}

export function merchantSuggestsSubscription(name) {
  if (!name || typeof name !== 'string') {
    return false
  }

  const normalized = name.toLowerCase()
  return SUBSCRIPTION_MERCHANT_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function isCoincidentalMerchantName(name) {
  if (!name || typeof name !== 'string') {
    return false
  }

  const upper = name.toUpperCase()
  return COINCIDENTAL_MERCHANT_FRAGMENTS.some((fragment) => upper.includes(fragment))
}

export function isNoisyRecurringCategory(category) {
  const normalized = normalizeCategoryLabel(category)

  if (!normalized || normalized === 'uncategorized') {
    return true
  }

  return NOISY_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function isSubscriptionLikelyCategory(category) {
  const normalized = normalizeCategoryLabel(category)

  if (!normalized || normalized === 'uncategorized') {
    return false
  }

  return SUBSCRIPTION_LIKELY_CATEGORY_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  )
}
