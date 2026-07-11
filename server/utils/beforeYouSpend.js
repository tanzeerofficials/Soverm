/*
 * BEFORE YOU SPEND (pure judgment)
 *
 * Lightweight check: fine / blows category soft limit / risks rent or payday.
 * Opt-in tool — not a full budget system (T2.3).
 */

import { roundCurrency } from './safeToSpend.js'

export const BEFORE_YOU_SPEND_VERDICTS = [
  'incomplete',
  'fine',
  'caution',
  'blows_category',
  'risks_rent',
  'risks_payday',
]

const RENT_HINT =
  /\b(rent|mortgage|housing|landlord|lease|hoa|property\s*tax)\b/i

const VERDICT_RANK = {
  incomplete: -1,
  fine: 0,
  caution: 1,
  blows_category: 2,
  risks_rent: 3,
  risks_payday: 4,
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

export function looksLikeRentObligation(bill) {
  const haystack = `${bill?.merchant ?? ''} ${bill?.category ?? ''} ${bill?.name ?? ''}`
  return RENT_HINT.test(haystack)
}

/**
 * Find a soft limit whose category matches the user's free-text category.
 */
export function matchSoftLimit(category, softLimits = []) {
  const needle = String(category || '')
    .trim()
    .toLowerCase()
  if (!needle) {
    return null
  }

  const exact = softLimits.find(
    (limit) => String(limit.category || '').toLowerCase() === needle
  )
  if (exact) {
    return exact
  }

  return (
    softLimits.find((limit) => {
      const label = String(limit.category || '').toLowerCase()
      return label.includes(needle) || needle.includes(label)
    }) ?? null
  )
}

/**
 * Pure judgment from already-loaded snapshot pieces.
 *
 * @param {{
 *   amount: number,
 *   category?: string | null,
 *   whatsLeft?: object | null,
 *   softLimits?: array,
 *   safeToSpend?: number | null,
 *   spendingCapConfigured?: boolean,
 * }} input
 */
export function judgeBeforeYouSpend({
  amount,
  category = null,
  whatsLeft = null,
  softLimits = [],
  safeToSpend = null,
  spendingCapConfigured = false,
} = {}) {
  const spend = roundCurrency(Math.max(0, Number(amount) || 0))
  const reasons = []
  let verdict = 'fine'
  let title = 'Looks fine'
  let detail = 'This amount fits within what we can see right now.'

  if (spend <= 0) {
    return {
      verdict: 'fine',
      title: 'Enter an amount',
      detail: 'Tell us how much you’re about to spend.',
      amount: 0,
      category: category || null,
      reasons: [],
      whatsLeftAfter: whatsLeft?.configured ? whatsLeft.amount : null,
      categoryLimit: null,
    }
  }

  const matchedLimit = matchSoftLimit(category, softLimits)
  let categoryLimit = null

  if (matchedLimit) {
    const projectedSpent = roundCurrency(
      (matchedLimit.spentThisMonth ?? 0) + spend
    )
    const remainingAfter = roundCurrency(
      (matchedLimit.monthlyLimit ?? 0) - projectedSpent
    )
    const warningPct = matchedLimit.alertWarningPercent ?? 80
    const projectedPercent =
      matchedLimit.monthlyLimit > 0
        ? Math.round((projectedSpent / matchedLimit.monthlyLimit) * 100)
        : 0

    categoryLimit = {
      category: matchedLimit.category,
      monthlyLimit: matchedLimit.monthlyLimit,
      spentThisMonth: matchedLimit.spentThisMonth,
      projectedSpent,
      remainingAfter,
      projectedPercent,
      isOver: remainingAfter < 0,
      isWarning: projectedPercent >= warningPct && remainingAfter >= 0,
    }

    if (remainingAfter < 0) {
      verdict = 'blows_category'
      title = `Blows your ${matchedLimit.category} category cap`
      detail = `You’ve spent ${formatMoney(matchedLimit.spentThisMonth)} of ${formatMoney(matchedLimit.monthlyLimit)} on ${matchedLimit.category}. This ${formatMoney(spend)} would put you ${formatMoney(Math.abs(remainingAfter))} over.`
      reasons.push({
        id: 'category_over',
        tone: 'warning',
        text: detail,
      })
    } else if (categoryLimit.isWarning) {
      if (VERDICT_RANK[verdict] < VERDICT_RANK.caution) {
        verdict = 'caution'
        title = `Tight on ${matchedLimit.category}`
        detail = `This would use about ${projectedPercent}% of your ${matchedLimit.category} category cap (${formatMoney(remainingAfter)} left after).`
      }
      reasons.push({
        id: 'category_warning',
        tone: 'warning',
        text: `Near your ${matchedLimit.category} category cap (${projectedPercent}% after this purchase).`,
      })
    }
  }

  const rentBills = (whatsLeft?.bills ?? []).filter(looksLikeRentObligation)
  const rentTotal = roundCurrency(
    rentBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0)
  )

  // Cash after purchase vs rent still due (uses net balance, not the
  // already-reserved what's-left figure — catches "spending the rent money").
  if (rentTotal > 0 && whatsLeft?.netBalance != null) {
    const cashAfter = roundCurrency(Number(whatsLeft.netBalance) - spend)
    if (cashAfter < rentTotal) {
      verdict = 'risks_rent'
      title = 'Risks covering rent / housing'
      detail = `After this ${formatMoney(spend)}, cash would be about ${formatMoney(Math.max(0, cashAfter))}, but ${formatMoney(rentTotal)} in rent/housing is still due before payday.`
      reasons.push({
        id: 'rent_risk',
        tone: 'danger',
        text: detail,
      })
    }
  }

  if (whatsLeft?.configured) {
    const left = whatsLeft.amount ?? 0
    const leftAfter = roundCurrency(left - spend)

    if (spend > left) {
      verdict = 'risks_payday'
      title = 'Risks making it to payday'
      detail = `You have about ${formatMoney(left)} left until payday after known bills. ${formatMoney(spend)} would put you short.`
      reasons.push({
        id: 'payday_short',
        tone: 'danger',
        text: detail,
      })
    } else if (spend > left * 0.5 && left > 0 && VERDICT_RANK[verdict] < VERDICT_RANK.caution) {
      verdict = 'caution'
      title = 'Uses a big chunk of what’s left'
      detail = `This is more than half of your ${formatMoney(left)} until payday. You’d have about ${formatMoney(leftAfter)} left.`
      reasons.push({
        id: 'payday_chunk',
        tone: 'warning',
        text: detail,
      })
    } else if (VERDICT_RANK[verdict] === VERDICT_RANK.fine) {
      detail = `After this, you’d still have about ${formatMoney(leftAfter)} until payday.`
      reasons.push({
        id: 'payday_ok',
        tone: 'fine',
        text: detail,
      })
    }
  } else {
    // Without payday we cannot honestly say "fine" against what's left.
    // Category soft-limit flags can still apply; otherwise ask them to set payday.
    if (verdict === 'fine') {
      verdict = 'incomplete'
      title = 'Set payday to check this purchase'
      detail =
        'We can only judge against what’s left until payday after you confirm when you get paid.'
    }
    reasons.push({
      id: 'payday_unconfigured',
      tone: 'warning',
      text: 'Confirm payday in Settings to check against what’s left until payday.',
    })
  }

  if (
    spendingCapConfigured &&
    safeToSpend != null &&
    Number.isFinite(Number(safeToSpend)) &&
    spend > Number(safeToSpend)
  ) {
    reasons.push({
      id: 'spending_cap',
      tone: 'warning',
      text: `This is above your monthly spending-cap room (${formatMoney(safeToSpend)}).`,
    })
    if (VERDICT_RANK[verdict] < VERDICT_RANK.caution) {
      verdict = 'caution'
      title = 'Above your spending cap room'
      detail = `Safe to spend under your cap is about ${formatMoney(safeToSpend)}; this purchase is larger.`
    }
  }

  if (verdict === 'fine' && reasons.length === 0) {
    reasons.push({
      id: 'ok',
      tone: 'fine',
      text: 'No payday or category flags for this amount.',
    })
  }

  return {
    verdict,
    title,
    detail,
    amount: spend,
    category: category || matchedLimit?.category || null,
    reasons,
    whatsLeftAfter:
      whatsLeft?.configured === true
        ? roundCurrency(Math.max(0, (whatsLeft.amount ?? 0) - spend))
        : null,
    whatsLeftConfigured: Boolean(whatsLeft?.configured),
    categoryLimit,
  }
}
