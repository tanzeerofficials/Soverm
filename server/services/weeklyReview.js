/*
 * WEEKLY REVIEW SERVICE
 *
 * Assembles the paycheck-to-paycheck weekly check-in payload.
 */

import db from '../db/index.js'
import { CONNECTED_ACCOUNT_TRANSACTION_JOINS } from '../utils/connectedAccountTransactions.js'
import { getCalendarWeekWindow } from '../utils/calendarWeek.js'
import { roundCurrency } from '../utils/safeToSpend.js'
import {
  buildHowYouDid,
  pickOneMove,
  pickOneRisk,
} from '../utils/weeklyReview.js'
import {
  buildBillCalendarWindows,
  buildPaydayRunwayCoach,
} from '../utils/paydayRunwayCoach.js'
import { buildTrackerSnapshotWithFallback } from './trackerSnapshot.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import { buildWeeklyActionFollowUps } from './actionsService.js'
import {
  buildBillDefenseFindings,
  buildCancelKeepWatchPrompt,
} from '../utils/billDefense.js'

const NON_PENDING_FILTER = 'AND (t.pending IS NOT TRUE)'
const EXCLUDE_TRANSFER_FILTER = `
  AND COALESCE(t.category, '') !~* 'transfer'
  AND COALESCE(t.name, '') !~* '\\btransfer\\b'
`

async function sumSpendingInRange(userId, startIso, endExclusiveIso) {
  const result = await db.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS spent
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       ${EXCLUDE_TRANSFER_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date`,
    [userId, startIso, endExclusiveIso]
  )
  return roundCurrency(result.rows[0].spent)
}

async function topCategoriesInRange(userId, startIso, endExclusiveIso, limit = 2) {
  const result = await db.query(
    `SELECT COALESCE(t.category, 'Uncategorized') AS category,
            COALESCE(SUM(t.amount), 0) AS amount
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND t.amount > 0
       ${NON_PENDING_FILTER}
       ${EXCLUDE_TRANSFER_FILTER}
       AND t.date >= $2::date
       AND t.date < $3::date
     GROUP BY 1
     ORDER BY amount DESC
     LIMIT $4`,
    [userId, startIso, endExclusiveIso, limit]
  )

  return result.rows.map((row) => ({
    category: row.category,
    amount: roundCurrency(row.amount),
  }))
}

async function earliestTransactionDate(userId) {
  const result = await db.query(
    `SELECT MIN(t.date)::text AS earliest
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}`,
    [userId]
  )
  const earliest = result.rows[0]?.earliest
  return earliest ? String(earliest).slice(0, 10) : null
}

function daysBetween(isoA, isoB) {
  const ms =
    new Date(`${isoB}T12:00:00`).getTime() - new Date(`${isoA}T12:00:00`).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

export async function buildWeeklyReviewForUser(userId, { referenceDate = new Date() } = {}) {
  const week = getCalendarWeekWindow(referenceDate)

  let snapshot
  try {
    snapshot = await buildTrackerSnapshotWithFallback(userId)
  } catch (err) {
    if (err.statusCode === 503) {
      snapshot = {
        accountCount: 0,
        whatsLeftUntilPayday: { configured: false },
        payday: { configured: false },
        categorySoftLimits: [],
        spendingTracker: null,
      }
    } else {
      throw err
    }
  }

  const [spentThisWeek, spentPriorWeek, topCategories, earliest, expensePayload] =
    await Promise.all([
      sumSpendingInRange(userId, week.weekStartIso, week.endExclusiveIso),
      sumSpendingInRange(userId, week.priorWeekStartIso, week.priorWeekEndExclusiveIso),
      topCategoriesInRange(userId, week.weekStartIso, week.endExclusiveIso),
      earliestTransactionDate(userId),
      loadExpenseAnalyzerData(userId).catch(() => ({ recurringCharges: [] })),
    ])

  const historyDays = earliest ? daysBetween(earliest, week.todayIso) : 0
  const sparse = snapshot.accountCount === 0 || historyDays < 7

  const howYouDid = buildHowYouDid({
    spentThisWeek,
    spentPriorWeek,
    topCategories,
    sparse,
  })

  const whatsLeft = snapshot.whatsLeftUntilPayday ?? {
    configured: false,
    amount: null,
    bills: [],
  }

  const billWindows = buildBillCalendarWindows(expensePayload.recurringCharges ?? [], {
    todayIso: week.todayIso,
  })

  const runwayCoach = buildPaydayRunwayCoach({
    whatsLeft,
    spentThisWeek,
    weekStartIso: week.weekStartIso,
    todayIso: week.todayIso,
    billWindows,
  })

  const risk = pickOneRisk({
    whatsLeft,
    categorySoftLimits: snapshot.categorySoftLimits ?? [],
    spendingTracker: snapshot.spendingTracker,
    sparse,
    runwayVerdict: runwayCoach.verdict,
  })

  const move = pickOneMove({
    whatsLeft,
    risk,
    paydayConfigured: snapshot.payday?.configured === true || whatsLeft.configured === true,
    runwayVerdict: runwayCoach.verdict,
  })

  const followUps = await buildWeeklyActionFollowUps(userId, { referenceDate }).catch(() => [])

  const billDefense = buildBillDefenseFindings({
    recurringCharges: expensePayload.recurringCharges ?? [],
    reviewCharges: expensePayload.reviewCharges ?? [],
    todayIso: week.todayIso,
    limit: 5,
  }).map((finding) => ({
    type: finding.type,
    tone: finding.tone,
    confidence: finding.confidence,
    title: finding.title,
    detail: finding.detail,
    merchant: finding.merchant,
    otherMerchant: finding.otherMerchant ?? null,
    monthlyEquivalent: finding.monthlyEquivalent ?? null,
    firstAmount: finding.firstAmount ?? null,
    lastAmount: finding.lastAmount ?? null,
    amountDelta: finding.amountDelta ?? null,
    percentIncrease: finding.percentIncrease ?? null,
    reviewPrompt: buildCancelKeepWatchPrompt(finding),
  }))

  // Prefer bill-defense risk when runway is fine and we have a strong finding
  let riskWithDefense = risk
  const topDefense = billDefense[0]
  if (
    topDefense &&
    (topDefense.type === 'price_increase' || topDefense.type === 'likely_trial') &&
    (risk.id === 'all-clear' || risk.id === 'upcoming-bill' || runwayCoach.verdict === 'fine')
  ) {
    riskWithDefense = {
      id: `bill-defense-${topDefense.type}`,
      tone: topDefense.tone === 'warning' ? 'warning' : 'neutral',
      title: topDefense.title,
      detail: topDefense.detail,
    }
  }

  return {
    week: {
      label: week.label,
      weekStartIso: week.weekStartIso,
      weekEndIso: week.weekEndIso,
      todayIso: week.todayIso,
      timeZone: week.timeZone,
    },
    sparse,
    historyDays,
    accountCount: snapshot.accountCount ?? 0,
    howYouDid,
    whatsLeft,
    runwayCoach,
    risk: riskWithDefense,
    move,
    followUps,
    billDefense,
    payday: snapshot.payday ?? null,
  }
}
