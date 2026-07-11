/*
 * BILL / SUBSCRIPTION DEFENSE (pure helpers)
 *
 * Flags price hikes, new recurrings, duplicates, and likely trials
 * from Expense Analyzer recurring charge payloads.
 */

import { roundCurrency } from './safeToSpend.js'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount ?? 0)
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) {
    return null
  }
  const ms =
    new Date(`${isoB}T12:00:00`).getTime() - new Date(`${isoA}T12:00:00`).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const TRIAL_HINT =
  /\b(trial|free trial|promo|introductory|intro offer|first month)\b/i

/**
 * Detect a meaningful price increase along a recurring chain.
 */
export function detectPriceIncrease(charge, { minDelta = 1, minPercent = 8 } = {}) {
  const first = Number(charge.firstAmount ?? charge.averageAmount)
  const last = Number(charge.lastAmount ?? charge.averageAmount)
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return null
  }

  const delta = roundCurrency(last - first)
  const percent = Math.round((delta / first) * 100)
  if (delta < minDelta || percent < minPercent) {
    return null
  }

  if ((charge.occurrenceCount ?? 0) < 2) {
    return null
  }

  return {
    type: 'price_increase',
    tone: 'warning',
    confidence: percent >= 20 ? 'high' : 'medium',
    merchant: charge.merchant,
    category: charge.category ?? null,
    cadence: charge.cadence,
    monthlyEquivalent: charge.monthlyEquivalent ?? last,
    firstAmount: roundCurrency(first),
    lastAmount: roundCurrency(last),
    amountDelta: delta,
    percentIncrease: percent,
    title: `${charge.merchant} got more expensive`,
    detail: `Up ${formatMoney(delta)} (${percent}%) from ${formatMoney(first)} to ${formatMoney(last)}.`,
    charge,
  }
}

/**
 * New or early recurring stream (few hits, recent last charge).
 */
export function detectNewRecurring(charge, { todayIso, withinDays = 21 } = {}) {
  const count = charge.occurrenceCount ?? 0
  const daysSince = daysBetween(charge.lastChargedDate, todayIso)
  if (daysSince == null || daysSince > withinDays) {
    return null
  }
  if (count > 3) {
    return null
  }

  const isNewish = count <= 2 || charge.confidence === 'low' || charge.needsReview
  if (!isNewish) {
    return null
  }

  return {
    type: 'new_recurring',
    tone: 'neutral',
    confidence: count <= 2 ? 'medium' : 'low',
    merchant: charge.merchant,
    category: charge.category ?? null,
    cadence: charge.cadence,
    monthlyEquivalent: charge.monthlyEquivalent ?? charge.averageAmount,
    title: `New recurring: ${charge.merchant}`,
    detail: `${count} charge${count === 1 ? '' : 's'} so far · last ${charge.lastChargedDate} · ~${formatMoney(charge.monthlyEquivalent ?? charge.averageAmount)}/mo.`,
    charge,
  }
}

/**
 * Likely trial / promo converting to paid.
 */
export function detectLikelyTrial(charge, { todayIso } = {}) {
  const name = `${charge.merchant ?? ''} ${charge.detectionReason?.summary ?? ''} ${charge.detectionReason?.detail ?? ''}`
  const keywordHit = TRIAL_HINT.test(name)
  const smallThenUp =
    Number(charge.firstAmount) > 0 &&
    Number(charge.lastAmount) > Number(charge.firstAmount) * 1.5 &&
    Number(charge.firstAmount) < 5
  const early = (charge.occurrenceCount ?? 0) <= 2
  const recent = (daysBetween(charge.lastChargedDate, todayIso) ?? 99) <= 45

  if (!((keywordHit || smallThenUp) && early && recent)) {
    return null
  }

  return {
    type: 'likely_trial',
    tone: 'warning',
    confidence: keywordHit ? 'high' : 'medium',
    merchant: charge.merchant,
    category: charge.category ?? null,
    cadence: charge.cadence,
    monthlyEquivalent: charge.monthlyEquivalent ?? charge.averageAmount,
    title: `Possible trial: ${charge.merchant}`,
    detail: keywordHit
      ? 'Looks like a trial or promo — decide keep / cancel before it renews at full price.'
      : `Started near ${formatMoney(charge.firstAmount)} and is now ${formatMoney(charge.lastAmount)}.`,
    charge,
  }
}

/**
 * True when two normalized merchant keys look like the same brand
 * (shared prefix, or one contains the other) — e.g. hulu vs huludisneybundle.
 */
function keysLookRelated(leftKey, rightKey) {
  if (!leftKey || !rightKey || leftKey === rightKey) {
    return leftKey === rightKey && leftKey.length >= 4
  }
  const shorter = leftKey.length <= rightKey.length ? leftKey : rightKey
  const longer = leftKey.length <= rightKey.length ? rightKey : leftKey
  if (shorter.length < 4) {
    return false
  }
  if (longer.startsWith(shorter) || longer.includes(shorter)) {
    return true
  }
  const prefixLen = Math.min(6, shorter.length)
  return longer.startsWith(shorter.slice(0, prefixLen))
}

/**
 * Duplicate-looking merchants (shared brand stem or near-identical names).
 */
export function detectDuplicateRecurrings(charges = []) {
  const findings = []
  const seenPairs = new Set()

  for (let i = 0; i < charges.length; i += 1) {
    for (let j = i + 1; j < charges.length; j += 1) {
      const left = charges[i]
      const right = charges[j]
      const leftKey = normalizeKey(left.merchantKey || left.merchant)
      const rightKey = normalizeKey(right.merchantKey || right.merchant)
      if (!keysLookRelated(leftKey, rightKey)) {
        continue
      }
      // Exact same merchant string is the same stream, not a duplicate pair
      if (leftKey === rightKey && normalizeKey(left.merchant) === normalizeKey(right.merchant)) {
        continue
      }

      const leftAmt = Number(left.monthlyEquivalent ?? left.averageAmount ?? 0)
      const rightAmt = Number(right.monthlyEquivalent ?? right.averageAmount ?? 0)
      const ratio =
        Math.min(leftAmt, rightAmt) / Math.max(leftAmt, rightAmt || 1)
      if (ratio < 0.7) {
        continue
      }

      const pairId = [leftKey, rightKey].sort().join('|')
      if (seenPairs.has(pairId)) {
        continue
      }
      seenPairs.add(pairId)

      findings.push({
        type: 'duplicate',
        tone: 'warning',
        confidence: 'medium',
        merchant: left.merchant,
        otherMerchant: right.merchant,
        category: left.category ?? right.category ?? null,
        cadence: left.cadence,
        monthlyEquivalent: roundCurrency(leftAmt + rightAmt),
        title: `Possible duplicate: ${left.merchant} & ${right.merchant}`,
        detail: `Both look recurring (~${formatMoney(leftAmt)} and ~${formatMoney(rightAmt)}/mo). Worth confirming you need both.`,
        charge: left,
        otherCharge: right,
      })
    }
  }

  return findings
}

/**
 * Build prioritized defense findings from confirmed + review charges.
 */
export function buildBillDefenseFindings({
  recurringCharges = [],
  reviewCharges = [],
  todayIso,
  limit = 6,
} = {}) {
  const all = [...recurringCharges, ...reviewCharges]
  const findings = []

  for (const charge of all) {
    const hike = detectPriceIncrease(charge)
    if (hike) {
      findings.push(hike)
    }
    const trial = detectLikelyTrial(charge, { todayIso })
    if (trial) {
      findings.push(trial)
    }
    const newbie = detectNewRecurring(charge, { todayIso })
    if (newbie && !trial) {
      findings.push(newbie)
    }
  }

  findings.push(...detectDuplicateRecurrings(recurringCharges))

  const priority = {
    price_increase: 0,
    likely_trial: 1,
    duplicate: 2,
    new_recurring: 3,
  }

  const confidenceRank = { high: 0, medium: 1, low: 2 }

  return findings
    .sort((left, right) => {
      const typeDiff = (priority[left.type] ?? 9) - (priority[right.type] ?? 9)
      if (typeDiff !== 0) {
        return typeDiff
      }
      return (
        (confidenceRank[left.confidence] ?? 9) - (confidenceRank[right.confidence] ?? 9)
      )
    })
    .slice(0, limit)
}

export function buildCancelKeepWatchPrompt(finding) {
  const merchant = finding.merchant || 'this subscription'
  const amount = finding.monthlyEquivalent ?? finding.lastAmount
  const amountHint =
    amount != null ? ` (about $${Number(amount).toFixed(2)}/mo)` : ''

  return `Help me decide on ${merchant}${amountHint}: should I keep it, cancel it, or watch one more cycle? Give a clear recommendation for someone living paycheck to paycheck.`
}
