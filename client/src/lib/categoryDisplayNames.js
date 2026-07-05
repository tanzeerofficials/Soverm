/*
 * Maps raw Plaid category strings to plain-English labels for display.
 * Keys are normalized (lowercase); unknown categories fall back to title case.
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
  transfer: 'Transfers',
  'bank fees': 'Bank Fees',
  healthcare: 'Healthcare',
  'personal care': 'Personal Care',
  groceries: 'Groceries',
  subscriptions: 'Subscriptions',
  income: 'Income',
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
