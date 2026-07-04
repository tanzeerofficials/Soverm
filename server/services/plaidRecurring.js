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

const PLAID_FREQUENCY_TO_CADENCE = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  SEMI_MONTHLY: 'biweekly',
  MONTHLY: 'monthly',
  ANNUALLY: 'annual',
  UNKNOWN: 'monthly',
}

function mapPlaidFrequency(frequency) {
  return PLAID_FREQUENCY_TO_CADENCE[frequency] ?? 'monthly'
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

export function mapPlaidStreamToRecurringCharge(stream, accountLookup = new Map()) {
  const merchantKey = streamGroupingKey(stream)
  const rawName = stream.merchant_name || stream.description || ''
  const cadence = mapPlaidFrequency(stream.frequency)
  const averageAmount = Math.round(Math.abs(Number(stream.average_amount?.amount ?? 0)) * 100) / 100
  const account = accountLookup.get(stream.account_id) ?? null

  const streamStatus = stream.status ?? 'UNKNOWN'
  const transactionCount = stream.transaction_ids?.length ?? 0
  const isMature = streamStatus === 'MATURE'
  const detectionReason = derivePlaidDetectionReason(streamStatus, transactionCount)

  return {
    merchant: streamMerchantLabel(stream),
    category: resolvePlaidTransactionCategory(stream) || 'Uncategorized',
    averageAmount,
    cadence,
    lastChargedDate: stream.last_date ?? null,
    nextExpectedDate: stream.predicted_next_date ?? null,
    occurrenceCount: transactionCount,
    confidence: isMature ? 'high' : 'medium',
    needsReview: !isMature,
    detectionReason,
    monthlyEquivalent: Math.round(monthlyEquivalentFromPlaid(stream, cadence) * 100) / 100,
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

export async function fetchPlaidRecurringOutflowsForUser(userId) {
  const tokensResult = await db.query(
    `SELECT DISTINCT COALESCE(pi.plaid_access_token, a.plaid_access_token) AS access_token
     FROM accounts a
     LEFT JOIN plaid_items pi ON a.plaid_item_id = pi.id
     WHERE a.user_id = $1
       AND COALESCE(pi.plaid_access_token, a.plaid_access_token) IS NOT NULL`,
    [userId]
  )

  if (tokensResult.rows.length === 0) {
    return []
  }

  const accountLookup = await loadAccountLookupByPlaidAccountId(userId)
  const streams = []

  for (const { access_token: accessToken } of tokensResult.rows) {
    try {
      const response = await plaidClient.transactionsRecurringGet({
        access_token: accessToken,
      })

      for (const stream of response.data.outflow_streams ?? []) {
        if (stream.is_active === false) {
          continue
        }

        streams.push(mapPlaidStreamToRecurringCharge(stream, accountLookup))
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

function shouldSkipPlaidStream(streamCharge) {
  const probe = { name: streamCharge.rawName || streamCharge.merchant, category: streamCharge.category }
  return (
    isExcludedFromRecurringDetection(probe) ||
    isCoincidentalMerchantName(streamCharge.rawName || streamCharge.merchant)
  )
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

    const match = merged.find(
      (charge) =>
        charge.merchantKey === plaidCharge.merchantKey ||
        normalizeMerchantName(charge.merchant) === plaidCharge.merchantKey ||
        amountsAreSimilar(charge.averageAmount, plaidCharge.averageAmount)
    )

    if (match) {
      match.source = 'both'
      match.confidence = 'high'
      match.needsReview = false
      match.detectionReason = deriveMergedDetectionReason(
        match.detectionReason,
        plaidCharge.detectionReason
      )
      if (plaidCharge.nextExpectedDate && !match.nextExpectedDate) {
        match.nextExpectedDate = plaidCharge.nextExpectedDate
      }
      continue
    }

    merged.push(plaidCharge)
  }

  return merged.sort((left, right) => right.monthlyEquivalent - left.monthlyEquivalent)
}
