import { normalizeMerchantName } from './merchantNormalize.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

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

function roundCurrency(amount) {
  return Math.round(amount * 100) / 100
}

function recurringMerchantKey(charge) {
  return charge.merchantKey ?? normalizeMerchantName(charge.merchant)
}

export function buildRecurringMerchantKeySet(recurringCharges) {
  const keys = new Set()

  for (const charge of recurringCharges) {
    keys.add(recurringMerchantKey(charge))
  }

  return keys
}

export function computeRecurringVsOneTimeSplit(transactions, recurringCharges) {
  const recurringMerchantKeys = buildRecurringMerchantKeySet(recurringCharges)
  const recurringMonthlyByCategory = new Map()
  const oneTimeByCategory = new Map()
  const recurringInPeriodByCategory = new Map()

  for (const charge of recurringCharges) {
    const category = charge.category || 'Uncategorized'
    const current = recurringMonthlyByCategory.get(category) ?? 0
    recurringMonthlyByCategory.set(
      category,
      current + Number(charge.monthlyEquivalent ?? charge.averageAmount ?? 0)
    )
  }

  for (const row of transactions) {
    if (!isPostedSpendingRow(row) || !isWithinDaysAgo(row.date, 30)) {
      continue
    }

    const category = row.category || 'Uncategorized'
    const amount = Number(row.amount)
    const isRecurringTransaction = recurringMerchantKeys.has(normalizeMerchantName(row.name))

    if (isRecurringTransaction) {
      recurringInPeriodByCategory.set(
        category,
        (recurringInPeriodByCategory.get(category) ?? 0) + amount
      )
      continue
    }

    oneTimeByCategory.set(category, (oneTimeByCategory.get(category) ?? 0) + amount)
  }

  return {
    recurringMonthlyByCategory: new Map(
      [...recurringMonthlyByCategory.entries()].map(([category, total]) => [
        category,
        roundCurrency(total),
      ])
    ),
    oneTimeByCategory: new Map(
      [...oneTimeByCategory.entries()].map(([category, total]) => [category, roundCurrency(total)])
    ),
    recurringInPeriodByCategory: new Map(
      [...recurringInPeriodByCategory.entries()].map(([category, total]) => [
        category,
        roundCurrency(total),
      ])
    ),
    totalOneTime: roundCurrency(
      [...oneTimeByCategory.values()].reduce((sum, total) => sum + total, 0)
    ),
    totalRecurringInPeriod: roundCurrency(
      [...recurringInPeriodByCategory.values()].reduce((sum, total) => sum + total, 0)
    ),
  }
}

export function getCategoryRecurringOneTimeFields(category, split) {
  return {
    recurringMonthly: split.recurringMonthlyByCategory.get(category) ?? 0,
    oneTimeTotal: split.oneTimeByCategory.get(category) ?? 0,
  }
}
