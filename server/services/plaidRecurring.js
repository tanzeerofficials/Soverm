import { plaidClient } from './plaid.js'
import db from '../db/index.js'
import { resolvePlaidTransactionCategory } from '../utils/plaidCategory.js'
import { formatMerchantDisplayLabel, normalizeMerchantName } from '../utils/merchantNormalize.js'
import {
  deriveMergedDetectionReason,
  derivePlaidDetectionReason,
} from '../utils/recurringDetectionMeta.js'
import {
  isCoincidentalMerchantName,
  isExcludedFromRecurringDetection,
} from '../utils/recurringChargeFilters.js'
import { decryptAccessToken } from '../utils/tokenCrypto.js'

const PLAID_FREQUENCY_TO_CADENCE = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  SEMI_MONTHLY: 'biweekly',
  MONTHLY: 'monthly',
  ANNUALLY: 'annual',
}

const INFERRED_CADENCE_GAPS = [
  { cadence: 'weekly', minDays: 6, maxDays: 8 },
  { cadence: 'biweekly', minDays: 13, maxDays: 15 },
  { cadence: 'monthly', minDays: 26, maxDays: 34 },
  { cadence: 'annual', minDays: 350, maxDays: 380 },
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * When Plaid reports UNKNOWN frequency, guess cadence from the stream's date span.
 * Why: treating UNKNOWN as monthly overstates a yearly charge ~12× in monthlyEquivalent.
 * Needs at least two dates (first/last) and a transaction count to compute an average gap.
 */
function inferCadenceFromStreamDates(stream) {
  const firstDate = stream.first_date
  const lastDate = stream.last_date
  const count = stream.transaction_ids?.length ?? 0

  if (!firstDate || !lastDate || count < 2) {
    return null
  }

  const firstMs = Date.parse(firstDate)
  const lastMs = Date.parse(lastDate)
  if (!Number.isFinite(firstMs) || !Number.isFinite(lastMs) || lastMs <= firstMs) {
    return null
  }

  const avgGapDays = (lastMs - firstMs) / MS_PER_DAY / (count - 1)
  const match = INFERRED_CADENCE_GAPS.find(
    (rule) => avgGapDays >= rule.minDays && avgGapDays <= rule.maxDays
  )
  return match?.cadence ?? null
}

/**
 * Maps Plaid's frequency enum to our cadence. UNKNOWN is not assumed monthly —
 * we try date inference first; callers mark review-only when that fails.
 */
function mapPlaidFrequency(frequency, stream = null) {
  if (frequency === 'UNKNOWN' || frequency == null) {
    return stream ? inferCadenceFromStreamDates(stream) : null
  }

  return PLAID_FREQUENCY_TO_CADENCE[frequency] ?? null
}

function monthlyEquivalentFromPlaid(stream, cadence) {
  const amount = Math.abs(Number(stream.average_amount?.amount ?? 0))

  switch (cadence) {
    case 'weekly':
      return amount * 4.33
    case 'biweekly':
      return amount * 2.17
    case 'annual':
      return amount / 12
    default:
      return amount
  }
}

function streamMerchantLabel(stream) {
  const raw = stream.merchant_name || stream.description || 'Unknown merchant'
  const groupingKey = normalizeMerchantName(raw)
  return formatMerchantDisplayLabel(groupingKey, raw)
}

function streamGroupingKey(stream) {
  return normalizeMerchantName(stream.merchant_name || stream.description || '')
}

export function mapPlaidStreamToRecurringCharge(
  stream,
  accountLookup = new Map(),
  amountEndpoints = {}
) {
  const merchantKey = streamGroupingKey(stream)
  const rawName = stream.merchant_name || stream.description || ''
  const mappedCadence = mapPlaidFrequency(stream.frequency, stream)
  const cadenceUnknown = mappedCadence == null
  // Unknown cadence: keep the raw average as a placeholder monthlyEquivalent for
  // review UI, but force needsReview so it never enters confirmed monthly totals.
  const cadence = mappedCadence ?? 'unknown'
  const { averageAmount, firstAmount, lastAmount } = streamAmountEndpoints(
    stream,
    amountEndpoints
  )
  const account = accountLookup.get(stream.account_id) ?? null

  const streamStatus = stream.status ?? 'UNKNOWN'
  const transactionCount = stream.transaction_ids?.length ?? 0
  const isMature = streamStatus === 'MATURE'
  const detectionReason = derivePlaidDetectionReason(streamStatus, transactionCount)
  const needsReview = !isMature || cadenceUnknown

  return {
    merchant: streamMerchantLabel(stream),
    category: resolvePlaidTransactionCategory(stream) || 'Uncategorized',
    averageAmount,
    firstAmount,
    lastAmount,
    amountDelta:
      firstAmount != null ? Math.round((lastAmount - firstAmount) * 100) / 100 : null,
    cadence,
    lastChargedDate: stream.last_date ?? null,
    nextExpectedDate: stream.predicted_next_date ?? null,
    occurrenceCount: transactionCount,
    confidence: isMature && !cadenceUnknown ? 'high' : 'medium',
    needsReview,
    detectionReason,
    monthlyEquivalent: cadenceUnknown
      ? averageAmount
      : Math.round(monthlyEquivalentFromPlaid(stream, cadence) * 100) / 100,
    source: 'plaid',
    accounts: account
      ? [
          {
            id: account.id,
            name: account.name,
            bankName: account.bankName,
            label: account.label,
          },
        ]
      : [],
    accountLabel: account?.label ?? null,
    primaryAccount: account,
    plaidStreamId: stream.stream_id ?? null,
    merchantKey,
    rawName,
  }
}

export async function loadAccountLookupByPlaidAccountId(userId) {
  const result = await db.query(
    `SELECT id, plaid_account_id, account_name, bank_name
     FROM accounts
     WHERE user_id = $1`,
    [userId]
  )

  const lookup = new Map()

  for (const row of result.rows) {
    lookup.set(row.plaid_account_id, {
      id: row.id,
      name: row.account_name,
      bankName: row.bank_name,
      label: row.bank_name && row.account_name
        ? `${row.bank_name} · ${row.account_name}`
        : row.account_name || row.bank_name || 'Unknown account',
    })
  }

  return lookup
}

export async function loadAmountEndpointsForPlaidTransactionIds(userId, transactionIds) {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return { firstAmount: null, lastAmount: null }
  }

  const result = await db.query(
    `SELECT amount, date
     FROM transactions
     WHERE user_id = $1
       AND plaid_transaction_id = ANY($2::text[])
     ORDER BY date ASC, amount ASC`,
    [userId, transactionIds]
  )

  if (result.rows.length === 0) {
    return { firstAmount: null, lastAmount: null }
  }

  return {
    firstAmount: roundMoney(result.rows[0].amount),
    lastAmount: roundMoney(result.rows[result.rows.length - 1].amount),
  }
}

export async function fetchPlaidRecurringOutflowsForUser(userId) {
  const tokensResult = await db.query(
    `SELECT DISTINCT pi.plaid_access_token AS access_token
     FROM accounts a
     INNER JOIN plaid_items pi ON a.plaid_item_id = pi.id
     WHERE a.user_id = $1
       AND pi.plaid_access_token IS NOT NULL`,
    [userId]
  )

  if (tokensResult.rows.length === 0) {
    return []
  }

  const accountLookup = await loadAccountLookupByPlaidAccountId(userId)
  const streams = []

  for (const { access_token: storedToken } of tokensResult.rows) {
    const accessToken = decryptAccessToken(storedToken)
    try {
      const response = await plaidClient.transactionsRecurringGet({
        access_token: accessToken,
      })

      for (const stream of response.data.outflow_streams ?? []) {
        if (stream.is_active === false) {
          continue
        }

        const amountEndpoints = await loadAmountEndpointsForPlaidTransactionIds(
          userId,
          stream.transaction_ids
        )
        streams.push(mapPlaidStreamToRecurringCharge(stream, accountLookup, amountEndpoints))
      }
    } catch (err) {
      console.warn(
        `Plaid recurring fetch skipped for user ${userId}:`,
        err.response?.data?.error_code ?? err.message
      )
    }
  }

  return streams
}

function amountsAreSimilar(left, right, tolerance = 0.05) {
  if (left === 0 && right === 0) {
    return true
  }

  const reference = Math.max(Math.abs(left), Math.abs(right))
  return Math.abs(left - right) / reference <= tolerance
}

function roundMoney(amount) {
  return Math.round(Math.abs(Number(amount) || 0) * 100) / 100
}

function streamAmountEndpoints(stream, lookupEndpoints = {}) {
  const averageAmount = roundMoney(stream.average_amount?.amount ?? 0)
  const lastFromPlaid = stream.last_amount?.amount
  const lastAmount =
    lastFromPlaid != null
      ? roundMoney(lastFromPlaid)
      : lookupEndpoints.lastAmount != null
        ? roundMoney(lookupEndpoints.lastAmount)
        : averageAmount
  const firstAmount =
    lookupEndpoints.firstAmount != null
      ? roundMoney(lookupEndpoints.firstAmount)
      : null

  return { averageAmount, firstAmount, lastAmount }
}

function shouldSkipPlaidStream(streamCharge) {
  const probe = {
    name: streamCharge.rawName || streamCharge.merchant,
    category: streamCharge.category,
  }
  // Keep payment/transfer exclusions only. Coincidental-name brands (Uber, DoorDash,
  // Walmart, …) are handled in markPlaidCoincidentalForReview — Plaid MATURE streams
  // for Uber One / DashPass / Walmart+ must not be dropped.
  return isExcludedFromRecurringDetection(probe)
}

/**
 * Plaid already verified these as recurring. The coincidental denylist is for
 * heuristic false positives (rides, takeout). Route membership-looking streams
 * into Review so users still see DashPass / Uber One without auto-confirming.
 */
function markPlaidCoincidentalForReview(plaidCharge) {
  const label = plaidCharge.rawName || plaidCharge.merchant
  if (!isCoincidentalMerchantName(label)) {
    return plaidCharge
  }

  return {
    ...plaidCharge,
    needsReview: true,
    confidence: 'medium',
    detectionReason: {
      code: 'plaid_coincidental_merchant',
      summary: 'Plaid found a recurring charge on a brand we usually treat as one-offs',
      detail:
        'Kept for review so memberships like Uber One or DashPass are not hidden — confirm if this is a real subscription',
    },
  }
}

function merchantKeysMatch(charge, plaidCharge) {
  return (
    charge.merchantKey === plaidCharge.merchantKey ||
    normalizeMerchantName(charge.merchant) === plaidCharge.merchantKey
  )
}

/**
 * Match Plaid ↔ heuristic only when merchant key AND amount both agree.
 * Merchant-only matching would collapse distinct same-descriptor streams
 * (iCloud $2.99 + Apple TV $9.99 both as APPLE.COM/BILL). Amount-only
 * matching would absorb unrelated merchants (Spotify $11.99 ≠ Hulu $11.99).
 */
function findHeuristicMatchForPlaidCharge(merged, plaidCharge) {
  const merchantMatches = merged.filter((charge) => merchantKeysMatch(charge, plaidCharge))
  if (merchantMatches.length === 0) {
    return null
  }

  return (
    merchantMatches.find((charge) =>
      amountsAreSimilar(charge.averageAmount, plaidCharge.averageAmount)
    ) ?? null
  )
}

function preferWiderAmountSpan(target, source) {
  if (source.firstAmount == null || source.lastAmount == null) {
    return
  }

  const targetDelta = Math.abs((target.lastAmount ?? 0) - (target.firstAmount ?? 0))
  const sourceDelta = Math.abs(source.lastAmount - source.firstAmount)
  if (sourceDelta <= targetDelta) {
    return
  }

  target.firstAmount = source.firstAmount
  target.lastAmount = source.lastAmount
  target.amountDelta = Math.round((source.lastAmount - source.firstAmount) * 100) / 100
}

export function mergeRecurringCharges(heuristicCharges, plaidCharges) {
  const merged = heuristicCharges.map((charge) => ({
    ...charge,
    source: charge.source ?? 'heuristic',
  }))

  for (const plaidCharge of plaidCharges) {
    if (shouldSkipPlaidStream(plaidCharge)) {
      continue
    }

    const incoming = markPlaidCoincidentalForReview(plaidCharge)
    const match = findHeuristicMatchForPlaidCharge(merged, incoming)

    if (match) {
      match.source = 'both'
      match.detectionReason = deriveMergedDetectionReason(
        match.detectionReason,
        incoming.detectionReason
      )
      preferWiderAmountSpan(match, incoming)
      if (incoming.nextExpectedDate && !match.nextExpectedDate) {
        match.nextExpectedDate = incoming.nextExpectedDate
      }
      // Coincidental brands stay in Review even when Plaid + heuristic agree.
      if (incoming.needsReview) {
        match.needsReview = true
        match.confidence = 'medium'
      } else {
        match.confidence = 'high'
        match.needsReview = false
      }
      continue
    }

    merged.push(incoming)
  }

  return merged.sort((left, right) => right.monthlyEquivalent - left.monthlyEquivalent)
}
