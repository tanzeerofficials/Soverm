/*
 * Maps raw category strings to plain-English labels for display.
 * Keys are normalized (lowercase); unknown categories fall back to title case.
 * Keep money-move taxonomy labels specific — never collapse to vague "Transfers".
 *
 * Examples are short “what counts here” hints under category labels — not a glossary.
 */

const CATEGORY_DISPLAY_NAMES = {
  'general merchandise': 'Shopping',
  'food and drink': 'Dining',
  'loan payments': 'Credit Card & Loan Payments',
  transportation: 'Rides & Transit',
  entertainment: 'Entertainment',
  recreation: 'Recreation',
  service: 'Services',
  'general services': 'Services',
  shops: 'Shopping',
  travel: 'Travel',
  'rent and utilities': 'Bills & Utilities',
  // Specific money-move taxonomy (preferred)
  'self deposit': 'Self deposit',
  'self transfer': 'Self transfer',
  'peer transfer': 'Peer transfer',
  'cash out': 'Cash out',
  'card/loan payment': 'Card/loan payment',
  // Legacy vague labels → still specific when shown
  transfer: 'Self transfer',
  transfers: 'Self transfer',
  'transfer in': 'Self transfer',
  'transfer out': 'Self transfer',
  'bank fees': 'Bank Fees',
  // Medical (Plaid PFC) + legacy Healthcare / Health → one label
  medical: 'Healthcare',
  healthcare: 'Healthcare',
  health: 'Healthcare',
  'personal care': 'Personal Care',
  groceries: 'Groceries',
  subscriptions: 'Subscriptions',
  income: 'Income',
  atm: 'Cash out',
  uncategorized: 'Uncategorized',
}

/**
 * Short examples keyed by display name (after formatCategoryDisplayName).
 * Missing keys → no example line in the UI.
 */
const CATEGORY_EXAMPLES_BY_DISPLAY_NAME = {
  Healthcare: 'Doctors, pharmacy, insurance',
  Dining: 'Restaurants, coffee, delivery',
  Shopping: 'Amazon, Target, clothes',
  Groceries: 'Supermarkets, grocery delivery',
  'Bills & Utilities': 'Rent, electric, internet, phone',
  Entertainment: 'Streaming, movies, events',
  Recreation: 'Gym, sports, hobbies',
  'Rides & Transit': 'Uber, transit, gas',
  'Personal Care': 'Haircuts, spa, cosmetics',
  Travel: 'Flights, hotels, Airbnb',
  Services: 'Repairs, professional fees',
  Subscriptions: 'Apps, memberships, software',
  'Bank Fees': 'Overdraft, ATM fees, monthly fees',
  'Credit Card & Loan Payments': 'Card payments, loan payments',
  'Cash out': 'ATM withdrawals, cash back',
  'Peer transfer': 'Zelle, Venmo, Cash App',
  'Self transfer': 'Moves between your own accounts',
  'Self deposit': 'ATM or mobile deposits',
  'Card/loan payment': 'Credit card or loan payments',
  Income: 'Paychecks, direct deposit',
}

function normalizeCategoryKey(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function titleCaseCategory(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function formatCategoryDisplayName(rawCategory) {
  const key = normalizeCategoryKey(rawCategory || 'Uncategorized')
  return CATEGORY_DISPLAY_NAMES[key] ?? titleCaseCategory(rawCategory || 'Uncategorized')
}

/*
 * What this does: returns a short “includes …” hint for a category label.
 * Why: users should know what counts under Dining vs Shopping without opening docs.
 */
export function getCategoryExamples(rawCategory) {
  const displayName = formatCategoryDisplayName(rawCategory)
  return CATEGORY_EXAMPLES_BY_DISPLAY_NAME[displayName] ?? null
}

export {
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_EXAMPLES_BY_DISPLAY_NAME,
  normalizeCategoryKey,
  titleCaseCategory,
}
