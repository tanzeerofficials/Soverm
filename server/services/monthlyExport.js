/*
 * MONTHLY SNAPSHOT EXPORT
 *
 * Assembles a read-only JSON snapshot of the current (or requested) calendar
 * month from existing helpers — no new tables.
 */

import { getCalendarMonthWindow } from '../utils/calendarMonth.js'
import { buildTrackerSnapshotWithFallback } from '../services/trackerSnapshot.js'
import { loadExpenseAnalyzerData } from '../utils/expenseAnalyzerData.js'
import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance } from '../utils/balanceHelpers.js'
import { csvEscape } from '../utils/csvEscape.js'

function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

/**
 * Builds an exportable monthly snapshot for one user.
 *
 * What it does:
 * - Collects balances, tracker progress, top categories, recurring, latest insight
 * Why: Users want a downloadable "how did this month go?" without screenshots
 */
export async function buildMonthlySnapshot(userId, { monthIso } = {}) {
  const window = monthIso
    ? getCalendarMonthWindow(new Date(`${monthIso}T12:00:00`))
    : getCalendarMonthWindow()

  const [accountsResult, trackerSnapshot, expenseAnalyzer, insightResult] = await Promise.all([
    db.query(
      `SELECT id, bank_name, account_name, account_type,
              balance_current, balance_available, currency
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
    buildTrackerSnapshotWithFallback(userId),
    loadExpenseAnalyzerData(userId),
    db.query(
      `SELECT id, content, created_at
       FROM insights
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    ),
  ])

  const accounts = accountsResult.rows.map((account) => ({
    ...account,
    displayBalance: getDisplayBalance(account),
  }))
  const netBalance = calculateTotalBalance(accounts)

  let latestInsight = null
  const insightRow = insightResult.rows[0]
  if (insightRow?.content) {
    try {
      const parsed =
        typeof insightRow.content === 'string'
          ? JSON.parse(insightRow.content)
          : insightRow.content
      latestInsight = {
        id: insightRow.id,
        createdAt: insightRow.created_at,
        headline: parsed?.headline ?? null,
        actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
      }
    } catch {
      latestInsight = { id: insightRow.id, createdAt: insightRow.created_at, headline: null, actions: [] }
    }
  }

  const categories = (expenseAnalyzer?.categoryBreakdown ?? []).slice(0, 12).map((entry) => ({
    category: entry.category,
    currentTotal: roundCurrency(entry.currentTotal ?? entry.total ?? 0),
    priorTotal: roundCurrency(entry.priorTotal ?? 0),
    percentOfTotal: entry.percentOfTotal ?? null,
  }))

  const recurring = (expenseAnalyzer?.recurringCharges ?? []).map((charge) => ({
    merchant: charge.merchant,
    monthlyEquivalent: roundCurrency(charge.monthlyEquivalent ?? charge.averageAmount ?? 0),
    nextExpectedDate: charge.nextExpectedDate ?? null,
    cadence: charge.cadence ?? null,
  }))

  return {
    exportedAt: new Date().toISOString(),
    period: {
      start: window.periodStart,
      end: window.periodEnd,
      label: window.periodLabel,
      timeZone: window.timeZone,
    },
    balances: {
      netBalance: roundCurrency(netBalance),
      accountCount: accounts.length,
    },
    trackers: {
      spentThisMonth: trackerSnapshot?.spentThisMonth ?? 0,
      incomeThisMonth: trackerSnapshot?.incomeThisMonth ?? 0,
      monthlyBudget: trackerSnapshot?.monthlyBudget ?? null,
      safeToSpend: trackerSnapshot?.safeToSpend ?? null,
      isOverBudget: trackerSnapshot?.isOverBudget ?? false,
      savingGoals: (trackerSnapshot?.savingTrackers ?? []).map((tracker) => ({
        name: tracker.name,
        monthlyAmount: tracker.monthlyAmount,
        savedThisMonth: tracker.progress?.savedThisMonth ?? tracker.progress?.saved ?? 0,
        purposeType: tracker.purposeType,
      })),
    },
    categories,
    recurring,
    latestInsight,
  }
}

export function monthlySnapshotToCsv(snapshot) {
  const lines = [
    'Section,Field,Value',
    `Period,Start,${snapshot.period.start}`,
    `Period,End,${snapshot.period.end}`,
    `Period,Label,${csvEscape(snapshot.period.label)}`,
    `Balances,Net balance,${snapshot.balances.netBalance}`,
    `Balances,Account count,${snapshot.balances.accountCount}`,
    `Trackers,Spent this month,${snapshot.trackers.spentThisMonth}`,
    `Trackers,Income this month,${snapshot.trackers.incomeThisMonth}`,
    `Trackers,Spending cap,${snapshot.trackers.monthlyBudget ?? ''}`,
    `Trackers,Safe to spend,${snapshot.trackers.safeToSpend ?? ''}`,
  ]

  for (const goal of snapshot.trackers.savingGoals ?? []) {
    lines.push(
      `Savings goal,${csvEscape(goal.name)},${goal.savedThisMonth} of ${goal.monthlyAmount}/mo`
    )
  }

  for (const category of snapshot.categories ?? []) {
    lines.push(`Category,${csvEscape(category.category)},${category.currentTotal}`)
  }

  for (const charge of snapshot.recurring ?? []) {
    lines.push(
      `Recurring,${csvEscape(charge.merchant)},${charge.monthlyEquivalent}/mo next ${charge.nextExpectedDate ?? ''}`
    )
  }

  if (snapshot.latestInsight?.headline) {
    lines.push(`Insight,Headline,${csvEscape(snapshot.latestInsight.headline)}`)
  }

  return `${lines.join('\n')}\n`
}
