import { createHash } from 'crypto'
import { isSignificantCategoryDelta } from './financialContext.js'

function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

function formatDelta(delta) {
  if (!delta) {
    return null
  }

  return {
    direction: delta.direction,
    percent: delta.percent,
  }
}

export function buildExpenseAnalyzerNarrativeBrief(payload) {
  const topMoverEntry = payload.topMover
    ? payload.categoryBreakdown?.find((entry) => entry.category === payload.topMover.category)
    : null

  const brief = {
    periodLabel: 'last 30 days vs prior 30 days',
    overallSpending: {
      currentTotal: roundCurrency(payload.overallSpending?.currentTotal ?? 0),
      priorTotal: roundCurrency(payload.overallSpending?.priorTotal ?? 0),
      hasComparisonData: payload.overallSpending?.hasComparisonData === true,
      delta: formatDelta(payload.overallSpending?.delta),
      confirmedRecurringMonthly: roundCurrency(payload.totalRecurringMonthly ?? 0),
      confirmedRecurringAnnual:
        (payload.totalRecurringMonthly ?? 0) > 0
          ? roundCurrency((payload.totalRecurringMonthly ?? 0) * 12)
          : 0,
      oneTimeTotal: roundCurrency(payload.overallSpending?.oneTimeTotal ?? 0),
    },
    topMover:
      payload.topMover && isSignificantCategoryDelta(payload.topMover)
        ? {
            category: payload.topMover.category,
            direction: payload.topMover.direction,
            percent: payload.topMover.percent,
            currentTotal: roundCurrency(topMoverEntry?.currentTotal ?? 0),
            recurringMonthly: roundCurrency(topMoverEntry?.recurringMonthly ?? 0),
            oneTimeTotal: roundCurrency(topMoverEntry?.oneTimeTotal ?? 0),
          }
        : null,
    confirmedRecurring: (payload.recurringCharges ?? []).map((charge) => ({
      merchant: charge.merchant,
      monthlyEquivalent: roundCurrency(charge.monthlyEquivalent ?? charge.averageAmount),
      category: charge.category || 'Uncategorized',
      whyFlagged: charge.detectionReason?.summary ?? null,
    })),
    reviewItems: (payload.reviewCharges ?? []).map((charge) => ({
      merchant: charge.merchant,
      monthlyEquivalent: roundCurrency(charge.monthlyEquivalent ?? charge.averageAmount),
      category: charge.category || 'Uncategorized',
      whyUncertain: charge.detectionReason?.summary ?? null,
    })),
    topCategories: (payload.categoryBreakdown ?? []).slice(0, 4).map((entry) => ({
      category: entry.category,
      currentTotal: roundCurrency(entry.currentTotal),
      recurringMonthly: roundCurrency(entry.recurringMonthly ?? 0),
      oneTimeTotal: roundCurrency(entry.oneTimeTotal ?? 0),
      delta: formatDelta(entry.delta),
    })),
    rules: {
      confirmedRecurringCount: payload.recurringCharges?.length ?? 0,
      reviewCount: payload.reviewCharges?.length ?? 0,
      reviewExcludedFromRecurringTotal: true,
    },
  }

  return brief
}

export function fingerprintExpenseAnalyzerBrief(brief) {
  return createHash('sha256').update(JSON.stringify(brief)).digest('hex').slice(0, 32)
}

export function buildNarrativeMeta(payload) {
  const brief = buildExpenseAnalyzerNarrativeBrief(payload)

  return {
    fingerprint: fingerprintExpenseAnalyzerBrief(brief),
    confirmedRecurringMonthly: brief.overallSpending.confirmedRecurringMonthly,
    reviewCount: brief.rules.reviewCount,
  }
}
