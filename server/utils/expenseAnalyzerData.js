import db from '../db/index.js'
import { normalizeMerchantName } from './merchantNormalize.js'
import {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
  isNoisyRecurringCategory,
  isSubscriptionLikelyCategory,
  merchantSuggestsSubscription,
} from './recurringChargeFilters.js'
import {
  buildCategoryBreakdownFromComparison,
  computeSpendingDelta,
  isSignificantCategoryDelta,
} from './financialContext.js'

export const NON_PENDING_FILTER = 'AND (pending IS NOT TRUE)'
const RECURRING_LOOKBACK_INTERVAL = '3 months'

const RECURRING_AMOUNT_TOLERANCE = 0.05
const KEYWORD_AMOUNT_TOLERANCE = 0.05
const MS_PER_DAY = 24 * 60 * 60 * 1000
const CROSS_ACCOUNT_DEDUPE_DAYS = 3
const STRICT_MONTHLY_MIN_DAYS = 27
const STRICT_MONTHLY_MAX_DAYS = 32
const IDENTICAL_AMOUNT_MIN_DAYS = 28
const IDENTICAL_AMOUNT_MAX_DAYS = 31
const MIN_STRICT_OCCURRENCES = 3

const CADENCE_RULES = [
  { cadence: 'weekly', minDays: 6, maxDays: 8, averageGapDays: 7 },
  { cadence: 'biweekly', minDays: 13, maxDays: 15, averageGapDays: 14 },
  { cadence: 'monthly', minDays: 27, maxDays: 33, averageGapDays: 30 },
  { cadence: 'annual', minDays: 350, maxDays: 380, averageGapDays: 365 },
]

function parseDateOnly(dateInput) {
  if (typeof dateInput === 'string') {
    const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const date = new Date(dateInput)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDateOnly(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(earlierDate, laterDate) {
  const start = parseDateOnly(earlierDate)
  const end = parseDateOnly(laterDate)
  return Math.round((end - start) / MS_PER_DAY)
}

function addDays(dateInput, days) {
  const date = parseDateOnly(dateInput)
  date.setDate(date.getDate() + days)
  return formatDateOnly(date)
}

function amountsWithinTolerance(amounts, tolerance = RECURRING_AMOUNT_TOLERANCE) {
  if (amounts.length < 2) {
    return false
  }

  const reference =
    amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length

  if (reference === 0) {
    return amounts.every((amount) => amount === 0)
  }

  return amounts.every(
    (amount) => Math.abs(amount - reference) / reference <= tolerance
  )
}

function isPostedSpendingRow(row) {
  const amount = Number(row.amount)
  return Number.isFinite(amount) && amount > 0 && row.date && row.pending !== true
}

function dedupeCrossAccountTransactions(transactions) {
  const sorted = [...transactions].sort(
    (left, right) => parseDateOnly(left.date) - parseDateOnly(right.date)
  )
  const kept = []

  for (const row of sorted) {
    const merchantKey = normalizeMerchantName(row.name)
    const amount = Number(row.amount)
    const duplicate = kept.find((existing) => {
      const sameMerchant = normalizeMerchantName(existing.name) === merchantKey
      const sameAmount = Math.abs(Number(existing.amount) - amount) <= amount * RECURRING_AMOUNT_TOLERANCE
      const closeDates =
        Math.abs(daysBetween(existing.date, row.date)) <= CROSS_ACCOUNT_DEDUPE_DAYS

      return sameMerchant && sameAmount && closeDates
    })

    if (!duplicate) {
      kept.push(row)
    }
  }

  return kept
}

function resolveCategoryFromChain(chain) {
  const counts = new Map()

  for (const row of chain) {
    const category = row.category || 'Uncategorized'
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0]
}

function allGapsWithin(chain, minDays, maxDays) {
  for (let index = 1; index < chain.length; index++) {
    const gapDays = daysBetween(chain[index - 1].date, chain[index].date)
    if (gapDays < minDays || gapDays > maxDays) {
      return false
    }
  }

  return true
}

function resolveMerchantLabel(chain) {
  return chain[chain.length - 1].name || chain[0].name || ''
}

function amountsAreIdentical(amounts) {
  if (amounts.length < 2) {
    return false
  }

  const cents = amounts.map((amount) => Math.round(Number(amount) * 100))
  return cents.every((value) => value === cents[0])
}

function chainMeetsStrictMonthlyBar(chain, amountTolerance = RECURRING_AMOUNT_TOLERANCE) {
  if (chain.length < MIN_STRICT_OCCURRENCES) {
    return false
  }

  if (!allGapsWithin(chain, STRICT_MONTHLY_MIN_DAYS, STRICT_MONTHLY_MAX_DAYS)) {
    return false
  }

  const amounts = chain.map((row) => Number(row.amount))
  return amountsWithinTolerance(amounts, amountTolerance)
}

function chainMeetsIdenticalAmountFallback(chain) {
  if (chain.length < MIN_STRICT_OCCURRENCES) {
    return false
  }

  if (!allGapsWithin(chain, IDENTICAL_AMOUNT_MIN_DAYS, IDENTICAL_AMOUNT_MAX_DAYS)) {
    return false
  }

  const amounts = chain.map((row) => Number(row.amount))
  return amountsAreIdentical(amounts)
}

function isIdenticalAmountFallbackChain(chain) {
  const merchantName = resolveMerchantLabel(chain)
  return (
    !merchantSuggestsSubscription(merchantName) &&
    !isSubscriptionLikelyCategory(resolveCategoryFromChain(chain)) &&
    chainMeetsIdenticalAmountFallback(chain)
  )
}

function shouldAcceptRecurringChain(chain, rule) {
  if (chain.some(isExcludedFromRecurringDetection)) {
    return false
  }

  const merchantName = resolveMerchantLabel(chain)

  if (isCoincidentalMerchantName(merchantName)) {
    return false
  }

  const amounts = chain.map((row) => Number(row.amount))
  const hasKeyword = merchantSuggestsSubscription(merchantName)
  const category = resolveCategoryFromChain(chain)

  if (hasKeyword) {
    if (rule.cadence === 'monthly') {
      return (
        chain.length >= 2 &&
        amountsWithinTolerance(amounts, KEYWORD_AMOUNT_TOLERANCE) &&
        allGapsWithin(chain, STRICT_MONTHLY_MIN_DAYS, STRICT_MONTHLY_MAX_DAYS)
      )
    }

    return chain.length >= 2 && amountsWithinTolerance(amounts, RECURRING_AMOUNT_TOLERANCE)
  }

  if (rule.cadence !== 'monthly') {
    return false
  }

  if (isSubscriptionLikelyCategory(category) && !isNoisyRecurringCategory(category)) {
    return chainMeetsStrictMonthlyBar(chain)
  }

  return chainMeetsIdenticalAmountFallback(chain)
}

function findBestChainForCadence(transactions, rule) {
  if (transactions.length < 2) {
    return null
  }

  const sorted = [...transactions].sort(
    (left, right) => parseDateOnly(left.date) - parseDateOnly(right.date)
  )

  let bestChain = []

  for (let start = 0; start < sorted.length; start++) {
    const chain = [sorted[start]]

    for (let index = start + 1; index < sorted.length; index++) {
      const candidate = sorted[index]
      const gapDays = daysBetween(chain[chain.length - 1].date, candidate.date)

      if (gapDays < rule.minDays || gapDays > rule.maxDays) {
        continue
      }

      const chainAmounts = chain.map((row) => Number(row.amount))
      const candidateAmount = Number(candidate.amount)

      if (!amountsWithinTolerance([...chainAmounts, candidateAmount])) {
        continue
      }

      chain.push(candidate)
    }

    if (chain.length > bestChain.length) {
      bestChain = chain
    }
  }

  return bestChain.length >= 2 ? { chain: bestChain, rule } : null
}

function findBestAcceptedChainForCadence(transactions, rule) {
  const match = findBestChainForCadence(transactions, rule)
  if (!match || !shouldAcceptRecurringChain(match.chain, rule)) {
    return null
  }

  return match
}

function averageGapDays(chain) {
  if (chain.length < 2) {
    return 30
  }

  let totalGap = 0

  for (let index = 1; index < chain.length; index++) {
    totalGap += daysBetween(chain[index - 1].date, chain[index].date)
  }

  return Math.round(totalGap / (chain.length - 1))
}

function monthlyEquivalentAmount(averageAmount, cadence) {
  switch (cadence) {
    case 'weekly':
      return averageAmount * 4.33
    case 'biweekly':
      return averageAmount * 2.17
    case 'annual':
      return averageAmount / 12
    default:
      return averageAmount
  }
}

function buildRecurringChargeFromMatch({ chain, rule }) {
  const amounts = chain.map((row) => Number(row.amount))
  const averageAmount =
    Math.round((amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length) * 100) /
    100
  const lastChargedDate = chain[chain.length - 1].date
  const gapDays = averageGapDays(chain)

  const merchantName = resolveMerchantLabel(chain)
  const hasKeyword = merchantSuggestsSubscription(merchantName)

  return {
    merchant: chain[chain.length - 1].name || chain[0].name || 'Unknown merchant',
    category: resolveCategoryFromChain(chain),
    averageAmount,
    cadence: rule.cadence,
    lastChargedDate: formatDateOnly(parseDateOnly(lastChargedDate)),
    nextExpectedDate: addDays(lastChargedDate, gapDays || rule.averageGapDays),
    occurrenceCount: chain.length,
    confidence:
      hasKeyword && chain.length >= 3
        ? 'high'
        : isIdenticalAmountFallbackChain(chain)
          ? 'medium'
          : chain.length >= 4 && amountsAreIdentical(amounts)
            ? 'high'
            : 'medium',
    monthlyEquivalent:
      Math.round(monthlyEquivalentAmount(averageAmount, rule.cadence) * 100) / 100,
  }
}

export function detectRecurringChargesFromTransactions(transactions) {
  const postedSpending = dedupeCrossAccountTransactions(
    transactions.filter(
      (row) => isPostedSpendingRow(row) && !isExcludedFromRecurringDetection(row)
    )
  )
  const byMerchant = new Map()

  for (const row of postedSpending) {
    const key = normalizeMerchantName(row.name)
    const group = byMerchant.get(key) ?? []
    group.push(row)
    byMerchant.set(key, group)
  }

  const recurring = []

  for (const group of byMerchant.values()) {
    let bestMatch = null

    for (const rule of CADENCE_RULES) {
      const match = findBestAcceptedChainForCadence(group, rule)
      if (!match) {
        continue
      }

      if (!bestMatch || match.chain.length > bestMatch.chain.length) {
        bestMatch = match
      }
    }

    if (bestMatch) {
      recurring.push(buildRecurringChargeFromMatch(bestMatch))
    }
  }

  return recurring.sort((left, right) => right.monthlyEquivalent - left.monthlyEquivalent)
}

function isWithinDaysAgo(dateInput, days) {
  const today = parseDateOnly(new Date())
  const target = parseDateOnly(dateInput)
  const diff = Math.round((today - target) / MS_PER_DAY)
  return diff >= 0 && diff <= days
}

function isWithinPriorPeriod(dateInput) {
  const today = parseDateOnly(new Date())
  const target = parseDateOnly(dateInput)
  const diff = Math.round((today - target) / MS_PER_DAY)
  return diff > 30 && diff <= 60
}

function buildCategoryTotals(rows) {
  const byCategory = {}

  for (const row of rows) {
    const category = row.category || 'Uncategorized'
    byCategory[category] = (byCategory[category] ?? 0) + Number(row.amount)
  }

  return byCategory
}

export function buildComparisonFromTransactions(transactions) {
  const currentSpendingRows = transactions.filter(
    (row) => isPostedSpendingRow(row) && isWithinDaysAgo(row.date, 30)
  )
  const priorSpendingRows = transactions.filter(
    (row) => isPostedSpendingRow(row) && isWithinPriorPeriod(row.date)
  )
  const currentIncomeRows = transactions.filter(
    (row) => Number(row.amount) < 0 && isWithinDaysAgo(row.date, 30)
  )
  const priorIncomeRows = transactions.filter(
    (row) => Number(row.amount) < 0 && isWithinPriorPeriod(row.date)
  )
  const priorAnyRows = transactions.filter((row) => isWithinPriorPeriod(row.date))

  const currentByCategory = buildCategoryTotals(currentSpendingRows)
  const priorByCategory = buildCategoryTotals(priorSpendingRows)

  return {
    hasComparisonData: priorAnyRows.length > 0,
    currentPeriod: {
      spending: {
        total: currentSpendingRows.reduce((sum, row) => sum + Number(row.amount), 0),
        byCategory: currentByCategory,
      },
      income: {
        total: currentIncomeRows.reduce(
          (sum, row) => sum + Math.abs(Number(row.amount)),
          0
        ),
      },
    },
    priorPeriod: {
      spending: {
        total: priorSpendingRows.reduce((sum, row) => sum + Number(row.amount), 0),
        byCategory: priorByCategory,
      },
      income: {
        total: priorIncomeRows.reduce(
          (sum, row) => sum + Math.abs(Number(row.amount)),
          0
        ),
      },
    },
  }
}

function toPublicCategoryDelta(spendingDelta) {
  if (!spendingDelta || spendingDelta.isNewCategory) {
    return null
  }

  return {
    direction: spendingDelta.direction,
    percent: spendingDelta.percent,
  }
}

function deriveTopMover(categoryBreakdown) {
  const topEntry = categoryBreakdown.find((entry) =>
    isSignificantCategoryDelta(entry.delta)
  )
  if (!topEntry?.delta) {
    return null
  }

  return {
    category: topEntry.category,
    direction: topEntry.delta.direction,
    percent: topEntry.delta.percent,
  }
}

function groupRecurringByCategory(recurringCharges) {
  const grouped = new Map()

  for (const charge of recurringCharges) {
    const category = charge.category || 'Uncategorized'
    const list = grouped.get(category) ?? []
    list.push(charge)
    grouped.set(category, list)
  }

  return Object.fromEntries(grouped.entries())
}

function sumRecurringMonthly(recurringCharges) {
  return (
    Math.round(
      recurringCharges.reduce((sum, charge) => sum + charge.monthlyEquivalent, 0) * 100
    ) / 100
  )
}

export function buildTemplateNarrative({
  topMover,
  overallSpending,
  recurringCharges,
  totalRecurringMonthly,
}) {
  const parts = []

  if (overallSpending?.delta && overallSpending.hasComparisonData) {
    const { direction, percent } = overallSpending.delta
    const hasNotableMover = isSignificantCategoryDelta(topMover)

    if (direction === 'flat' && !hasNotableMover) {
      parts.push('Spending was steady across all categories vs the prior 30 days.')
    } else if (direction === 'flat') {
      parts.push('Overall spending held steady vs the prior 30 days.')
    } else if (percent != null) {
      parts.push(
        `Overall spending is ${direction} ${percent}% vs the prior 30 days ($${overallSpending.currentTotal} vs $${overallSpending.priorTotal}).`
      )
    }
  }

  if (isSignificantCategoryDelta(topMover) && topMover.percent != null) {
    parts.push(
      `${topMover.category} is your biggest mover, ${topMover.direction} ${topMover.percent}% vs the prior 30 days.`
    )
  }

  if (recurringCharges.length > 0) {
    const topRecurring = recurringCharges.slice(0, 3)
    const names = topRecurring.map((charge) => charge.merchant).join(', ')
    parts.push(
      `We detected ${recurringCharges.length} recurring charge${recurringCharges.length === 1 ? '' : 's'} totaling about $${totalRecurringMonthly}/mo${names ? `, including ${names}` : ''}.`
    )
  }

  if (parts.length === 0) {
    return null
  }

  return parts.join(' ')
}

export function buildExpenseAnalyzerPayload(comparison, recurringLookbackRows) {
  const recurringCharges = detectRecurringChargesFromTransactions(recurringLookbackRows)
  const recurringByCategory = groupRecurringByCategory(recurringCharges)
  const currentSpendingTotal = comparison.currentPeriod.spending.total
  const priorSpendingTotal = comparison.priorPeriod.spending.total
  const overallDelta = comparison.hasComparisonData
    ? computeSpendingDelta(currentSpendingTotal, priorSpendingTotal)
    : null

  const categoryBreakdown = buildCategoryBreakdownFromComparison(comparison).map(
    ({ category, currentTotal, priorTotal, spendingDelta }) => ({
      category,
      currentTotal,
      priorTotal,
      delta: toPublicCategoryDelta(spendingDelta),
      percentOfTotal:
        currentSpendingTotal > 0
          ? Math.round((currentTotal / currentSpendingTotal) * 1000) / 10
          : 0,
      recurringCharges: recurringByCategory[category] ?? [],
    })
  )

  const overallSpending = {
    currentTotal: Math.round(currentSpendingTotal * 100) / 100,
    priorTotal: Math.round(priorSpendingTotal * 100) / 100,
    hasComparisonData: comparison.hasComparisonData,
    delta: overallDelta
      ? { direction: overallDelta.direction, percent: overallDelta.percent }
      : null,
  }

  const totalRecurringMonthly = sumRecurringMonthly(recurringCharges)
  const topMover = deriveTopMover(categoryBreakdown)

  return {
    categoryBreakdown,
    recurringCharges,
    recurringByCategory,
    topMover,
    totalRecurringMonthly,
    overallSpending,
    narrativeSummary: buildTemplateNarrative({
      topMover,
      overallSpending,
      recurringCharges,
      totalRecurringMonthly,
    }),
  }
}

export function buildExpenseAnalyzerSummary(payload) {
  return {
    recurringCount: payload.recurringCharges.length,
    totalRecurringMonthly: payload.totalRecurringMonthly,
    topMover: payload.topMover,
  }
}

export async function loadExpenseAnalyzerData(userId) {
  const result = await db.query(
    `SELECT name, amount, date, category, pending
     FROM transactions
     WHERE user_id = $1
       AND date >= NOW() - $2::interval
       ${NON_PENDING_FILTER}
     ORDER BY date ASC`,
    [userId, RECURRING_LOOKBACK_INTERVAL]
  )

  const comparison = buildComparisonFromTransactions(result.rows)

  return buildExpenseAnalyzerPayload(comparison, result.rows)
}

export async function loadRecentTransactionsForRecurring(userId) {
  const result = await db.query(
    `SELECT name, amount, date, category, pending
     FROM transactions
     WHERE user_id = $1
       AND amount > 0
       AND date >= NOW() - $2::interval
       ${NON_PENDING_FILTER}
     ORDER BY date ASC`,
    [userId, RECURRING_LOOKBACK_INTERVAL]
  )

  return result.rows
}
