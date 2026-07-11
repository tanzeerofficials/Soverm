import { loadExpenseAnalyzerData } from './expenseAnalyzerData.js'
import { formatConfidenceLabel } from './recurringDetectionMeta.js'

function roundChatCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

function formatRecurringSourceLabel(source) {
  switch (source) {
    case 'plaid':
      return 'Plaid verified'
    case 'both':
      return 'Plaid + pattern detection'
    default:
      return 'Pattern detection'
  }
}

function normalizeDetectionReason(detectionReason) {
  if (!detectionReason) {
    return null
  }

  if (typeof detectionReason === 'string') {
    return { summary: detectionReason }
  }

  return {
    summary: detectionReason.summary ?? null,
    detail: detectionReason.detail ?? null,
  }
}

function mapRecurringCharge(charge, tier) {
  return {
    tier,
    merchant: charge.merchant,
    category: charge.category,
    averageAmount: charge.averageAmount,
    monthlyEquivalent: charge.monthlyEquivalent,
    annualEquivalent: roundChatCurrency((charge.monthlyEquivalent ?? 0) * 12),
    cadence: charge.cadence,
    source: charge.source,
    sourceLabel: formatRecurringSourceLabel(charge.source),
    confidence: charge.confidence,
    confidenceLabel: formatConfidenceLabel(charge.confidence),
    accountLabel: charge.accountLabel ?? null,
    accounts: charge.accounts ?? null,
    occurrenceCount: charge.occurrenceCount ?? null,
    lastChargedDate: charge.lastChargedDate ?? null,
    nextExpectedDate: charge.nextExpectedDate ?? null,
    detectionReason: normalizeDetectionReason(charge.detectionReason),
  }
}

/*
 * buildExpenseAnalyzerChatContextFromPayload(payload)
 *
 * Chat-safe snapshot of Expense Analyzer — categories, recurring charges,
 * annualized totals, confidence tiers, and per-category drill-down hints.
 */
export function buildExpenseAnalyzerChatContextFromPayload(payload) {
  if (!payload) {
    return null
  }

  const totalRecurringMonthly = Number(payload.totalRecurringMonthly ?? 0)
  const totalRecurringAnnual =
    totalRecurringMonthly > 0 ? roundChatCurrency(totalRecurringMonthly * 12) : 0
  const reviewCharges = payload.reviewCharges ?? []

  return {
    capturedAt: new Date().toISOString(),
    periodLabel: 'last 30 days vs prior 30 days',
    scope: 'connected accounts only',
    categoryBreakdown: (payload.categoryBreakdown ?? []).map(
      ({
        category,
        currentTotal,
        priorTotal,
        delta,
        recurringMonthly,
        oneTimeTotal,
        percentOfTotal,
        accountBreakdown,
        topMerchants,
      }) => ({
        category,
        currentTotal,
        priorTotal,
        delta,
        recurringMonthly,
        oneTimeTotal,
        percentOfTotal,
        accountBreakdown: (accountBreakdown ?? []).slice(0, 5),
        topMerchants: (topMerchants ?? []).slice(0, 5),
      })
    ),
    confirmedRecurring: (payload.recurringCharges ?? []).map((charge) =>
      mapRecurringCharge(charge, 'confirmed')
    ),
    reviewRecurring: reviewCharges.map((charge) => mapRecurringCharge(charge, 'review')),
    totals: {
      confirmedRecurringMonthly: totalRecurringMonthly,
      confirmedRecurringAnnual: totalRecurringAnnual,
      reviewMonthlyIfConfirmed: Number(payload.totalReviewMonthly ?? 0),
      confirmedCount: payload.recurringCharges?.length ?? 0,
      reviewCount: reviewCharges.length,
    },
    topMover: payload.topMover ?? null,
    overallSpending: payload.overallSpending ?? null,
    billDefense: (payload.billDefense ?? []).slice(0, 6).map((finding) => ({
      type: finding.type ?? null,
      tone: finding.tone ?? null,
      merchant: finding.merchant ?? null,
      title: finding.title ?? null,
      detail: finding.detail ?? null,
      monthlyEquivalent: roundChatCurrency(finding.monthlyEquivalent ?? 0),
      percentIncrease: finding.percentIncrease ?? null,
      amountDelta: finding.amountDelta != null ? roundChatCurrency(finding.amountDelta) : null,
    })),
  }
}

/*
 * loadExpenseAnalyzerChatContext(userId)
 *
 * Live Expense Analyzer snapshot for insight-scoped chat.
 */
export async function loadExpenseAnalyzerChatContext(userId) {
  const payload = await loadExpenseAnalyzerData(userId)

  return buildExpenseAnalyzerChatContextFromPayload(payload)
}
