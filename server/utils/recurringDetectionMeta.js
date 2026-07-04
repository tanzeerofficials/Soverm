import {
  isSubscriptionLikelyCategory,
  isNoisyRecurringCategory,
  merchantSuggestsSubscription,
  resolveSubscriptionMerchantKeyword,
} from './recurringChargeFilters.js'

export function deriveHeuristicDetectionReason({
  chain,
  rule,
  merchantName,
  hasKeyword,
  amounts,
  category,
  isIdenticalFallback,
}) {
  const cadenceLabel = rule.cadence

  if (hasKeyword) {
    const keyword = resolveSubscriptionMerchantKeyword(merchantName)
    const uncertain = chain.length < 3

    return {
      code: uncertain ? 'keyword_partial' : 'keyword_match',
      summary: uncertain
        ? `Possible subscription — keyword “${keyword}” but only ${chain.length} charges`
        : `Subscription keyword “${keyword}” matched`,
      detail: uncertain
        ? `${chain.length} ${cadenceLabel} charges so far — we usually want 3+ before calling it confirmed`
        : `${chain.length} ${cadenceLabel} charges at similar amounts`,
    }
  }

  if (isIdenticalFallback) {
    return {
      code: 'identical_amounts',
      summary: `${chain.length} identical charges ~30 days apart`,
      detail: `$${amounts[0]} each with no subscription keyword — could be a bill or a coincidence`,
    }
  }

  if (isSubscriptionLikelyCategory(category) && !isNoisyRecurringCategory(category)) {
    return {
      code: 'category_pattern',
      summary: `Monthly pattern in ${category}`,
      detail: `${chain.length} similar-amount ${cadenceLabel} charges`,
    }
  }

  return {
    code: 'pattern_match',
    summary: `${chain.length} ${cadenceLabel} charges at regular intervals`,
    detail: 'Similar amounts repeated over time',
  }
}

export function derivePlaidDetectionReason(streamStatus, transactionCount) {
  if (streamStatus === 'MATURE') {
    return {
      code: 'plaid_verified',
      summary: 'Plaid verified recurring stream',
      detail: `Mature stream with ${transactionCount} linked transaction${transactionCount === 1 ? '' : 's'}`,
    }
  }

  return {
    code: 'plaid_early',
    summary: 'Plaid flagged this as recurring — still building history',
    detail: `Only ${transactionCount} transaction${transactionCount === 1 ? '' : 's'} in the stream so far`,
  }
}

export function deriveMergedDetectionReason(heuristicReason, plaidReason) {
  return {
    code: 'plaid_and_pattern',
    summary: 'Plaid and your transaction pattern agree',
    detail: [heuristicReason?.summary, plaidReason?.summary].filter(Boolean).join(' · '),
  }
}

export function deriveBorderlineDetectionReason({ merchantName, chainLength, hasKeyword, identicalAmounts }) {
  if (hasKeyword) {
    const keyword = resolveSubscriptionMerchantKeyword(merchantName)
    return {
      code: 'keyword_borderline',
      summary: `Only ${chainLength} charges for “${keyword}” — too early to confirm`,
      detail: 'Connect more history or confirm manually if this is a subscription',
    }
  }

  if (identicalAmounts) {
    return {
      code: 'identical_borderline',
      summary: `Two identical charges ~30 days apart ($${identicalAmounts})`,
      detail: 'Could be a new subscription or a repeated one-off purchase',
    }
  }

  return {
    code: 'pattern_borderline',
    summary: 'Short recurring-looking pattern',
    detail: 'Not enough history yet to confirm as a subscription',
  }
}

export function partitionRecurringCharges(charges) {
  const confirmed = []
  const review = []

  for (const charge of charges) {
    if (charge.needsReview === true || charge.confidence !== 'high') {
      review.push(charge)
    } else {
      confirmed.push(charge)
    }
  }

  return { confirmed, review }
}

export function formatConfidenceLabel(confidence) {
  switch (confidence) {
    case 'high':
      return 'Confirmed'
    case 'medium':
      return 'Likely'
    case 'low':
      return 'Uncertain'
    default:
      return confidence
  }
}
