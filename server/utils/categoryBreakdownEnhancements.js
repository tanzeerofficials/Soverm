import { formatAccountLabel } from './accountLabel.js'
import { normalizeMerchantName } from './merchantNormalize.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const TOP_MERCHANTS_LIMIT = 5
const RECENT_TRANSACTIONS_LIMIT = 8

function parseDateOnly(dateInput) {
  if (typeof dateInput === 'string') {
    const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const date = new Date(dateInput)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isWithinDaysAgo(dateInput, days) {
  const today = parseDateOnly(new Date())
  const target = parseDateOnly(dateInput)
  const diff = Math.round((today - target) / MS_PER_DAY)
  return diff >= 0 && diff <= days
}

function isPostedSpendingRow(row) {
  const amount = Number(row.amount)
  return Number.isFinite(amount) && amount > 0 && row.date && row.pending !== true
}

function accountSnapshotFromRow(row) {
  return {
    id: row.account_id ?? null,
    name: row.account_name ?? 'Disconnected account',
    bankName: row.bank_name ?? null,
    label: formatAccountLabel({
      id: row.account_id,
      name: row.account_name,
      bankName: row.bank_name,
    }),
  }
}

function formatPublicDate(dateInput) {
  const date = parseDateOnly(dateInput)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildCategoryAccountBreakdowns(transactions) {
  const currentRows = transactions.filter(
    (row) => isPostedSpendingRow(row) && isWithinDaysAgo(row.date, 30)
  )
  const byCategory = new Map()

  for (const row of currentRows) {
    const category = row.category || 'Uncategorized'
    const account = accountSnapshotFromRow(row)
    const accountKey = account.id ?? account.label
    const categoryMap = byCategory.get(category) ?? new Map()

    const existing = categoryMap.get(accountKey) ?? {
      accountId: account.id,
      name: account.name,
      bankName: account.bankName,
      label: account.label,
      total: 0,
    }

    existing.total += Number(row.amount)
    categoryMap.set(accountKey, existing)
    byCategory.set(category, categoryMap)
  }

  const result = new Map()

  for (const [category, accountMap] of byCategory) {
    result.set(
      category,
      [...accountMap.values()]
        .sort((left, right) => right.total - left.total)
        .map((entry) => ({
          accountId: entry.accountId,
          name: entry.name,
          bankName: entry.bankName,
          label: entry.label,
          total: Math.round(entry.total * 100) / 100,
        }))
    )
  }

  return result
}

export function buildCategoryDrillDownMaps(transactions) {
  const currentRows = transactions.filter(
    (row) => isPostedSpendingRow(row) && isWithinDaysAgo(row.date, 30)
  )
  const byCategory = new Map()

  for (const row of currentRows) {
    const category = row.category || 'Uncategorized'
    const list = byCategory.get(category) ?? []
    list.push(row)
    byCategory.set(category, list)
  }

  const result = new Map()

  for (const [category, rows] of byCategory) {
    const merchantTotals = new Map()

    for (const row of rows) {
      const merchantKey = normalizeMerchantName(row.name)
      const existing = merchantTotals.get(merchantKey) ?? {
        merchant: row.name,
        total: 0,
        transactionCount: 0,
      }

      existing.total += Number(row.amount)
      existing.transactionCount += 1
      merchantTotals.set(merchantKey, existing)
    }

    const topMerchants = [...merchantTotals.values()]
      .sort((left, right) => right.total - left.total)
      .slice(0, TOP_MERCHANTS_LIMIT)
      .map((entry) => ({
        merchant: entry.merchant,
        total: Math.round(entry.total * 100) / 100,
        transactionCount: entry.transactionCount,
      }))

    const recentTransactions = [...rows]
      .sort((left, right) => parseDateOnly(right.date) - parseDateOnly(left.date))
      .slice(0, RECENT_TRANSACTIONS_LIMIT)
      .map((row) => ({
        name: row.name,
        amount: Math.round(Number(row.amount) * 100) / 100,
        date: formatPublicDate(row.date),
        accountLabel: accountSnapshotFromRow(row).label,
      }))

    result.set(category, { topMerchants, recentTransactions })
  }

  return result
}
