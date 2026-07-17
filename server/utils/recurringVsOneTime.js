import { normalizeMerchantName } from './merchantNormalize.js'
import { isWithinAppDaysAgo } from './calendarMonth.js'
import { isCashFlowSpendingRow } from './cashFlowClassification.js'
import { resolveSpendingCategoryLabel } from './plaidCategory.js'
import { roundCurrency } from './safeToSpend.js'

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

/*
 * Split recent spending into recurring vs one-time using the same cash-flow
 * classifier and category remapping as Expense Analyzer / Cash Flow.
 * Why: raw amount>0 + stored category inflated one-time with transfers/card
 * payments and mismatched category labels users see elsewhere.
 */
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
    if (!isCashFlowSpendingRow(row) || !isWithinAppDaysAgo(row.date, 30)) {
      continue
    }

    const category = resolveSpendingCategoryLabel(row)
    const amount = Math.abs(Number(row.amount) || 0)
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
