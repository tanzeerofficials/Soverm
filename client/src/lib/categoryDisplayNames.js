/*
 * Maps raw category strings to plain-English labels for display.
 * Keys are normalized (lowercase); unknown categories fall back to title case.
 * Keep money-move taxonomy labels specific — never collapse to vague "Transfers".
 */

const CATEGORY_DISPLAY_NAMES = {
  'general merchandise': 'Shopping',
  'food and drink': 'Dining',
  'loan payments': 'Credit Card & Loan Payments',
  transportation: 'Rides & Transit',
  entertainment: 'Entertainment',
  recreation: 'Recreation',
  service: 'Services',
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
  healthcare: 'Healthcare',
  'personal care': 'Personal Care',
  groceries: 'Groceries',
  subscriptions: 'Subscriptions',
  income: 'Income',
  atm: 'Cash out',
  uncategorized: 'Uncategorized',
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

export { CATEGORY_DISPLAY_NAMES, normalizeCategoryKey, titleCaseCategory }
