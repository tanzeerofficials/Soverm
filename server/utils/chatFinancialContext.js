import db from '../db/index.js'
import { calculateTotalBalance, getDisplayBalance, isLiabilityAccount } from './balanceHelpers.js'
import {
  buildCategoryBreakdownFromComparison,
  COMPARISON_PERIOD_INTERVAL,
  computeSpendingDelta,
  loadMonthOverMonthComparison,
} from './financialContext.js'
import {
  CONNECTED_ACCOUNT_TRANSACTION_JOINS,
  EXPENSE_ANALYZER_TRANSACTION_SELECT,
} from './connectedAccountTransactions.js'
import { loadExpenseAnalyzerChatContext } from './expenseAnalyzerChatContext.js'
import { loadChatPmfContext } from './chatPmfContext.js'

const RECENT_TRANSACTION_LIMIT = 20
const TOP_MERCHANT_LIMIT = 10
const LARGEST_TRANSACTION_LIMIT = 5
const DISCONNECTED_LOOKBACK_INTERVAL = '3 months'

function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

function summarizeTransaction(row) {
  return {
    date: row.date,
    merchant: row.name,
    amount: roundCurrency(row.amount),
    category: row.category || 'Uncategorized',
    account: row.account_name || row.bank_name || null,
  }
}

function buildTopMerchants(transactions) {
  const totals = new Map()

  for (const row of transactions) {
    const merchant = row.name || 'Unknown'
    const current = totals.get(merchant) ?? { merchant, total: 0, count: 0 }
    current.total += Number(row.amount)
    current.count += 1
    totals.set(merchant, current)
  }

  return [...totals.values()]
    .sort((left, right) => right.total - left.total)
    .slice(0, TOP_MERCHANT_LIMIT)
    .map(({ merchant, total, count }) => ({
      merchant,
      total: roundCurrency(total),
      transactionCount: count,
    }))
}

function buildRecentActivitySummary(transactions) {
  const spending = transactions.filter((row) => Number(row.amount) > 0)
  const income = transactions.filter((row) => Number(row.amount) < 0)

  const totalSpending = spending.reduce((sum, row) => sum + Number(row.amount), 0)
  const totalIncome = income.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0)

  const largestSpending = [...spending]
    .sort((left, right) => Number(right.amount) - Number(left.amount))
    .slice(0, LARGEST_TRANSACTION_LIMIT)
    .map(summarizeTransaction)

  return {
    periodLabel: 'last 30 days',
    scope: 'connected accounts only',
    spendingTransactionCount: spending.length,
    totalSpending: roundCurrency(totalSpending),
    totalIncome: roundCurrency(totalIncome),
    topMerchants: buildTopMerchants(spending),
    largestRecentSpending: largestSpending,
    recentTransactions: spending.slice(0, RECENT_TRANSACTION_LIMIT).map(summarizeTransaction),
  }
}

function buildLiveMonthOverMonthSnapshot(comparison) {
  if (!comparison?.hasComparisonData) {
    return { hasData: false, scope: 'connected accounts only' }
  }

  const spendingDelta = computeSpendingDelta(
    comparison.currentPeriod.spending.total,
    comparison.priorPeriod.spending.total
  )
  const incomeDelta = computeSpendingDelta(
    comparison.currentPeriod.income.total,
    comparison.priorPeriod.income.total
  )

  return {
    hasData: true,
    scope: 'connected accounts only',
    periodLabel: 'last 30 days vs prior 30 days',
    spending: {
      currentTotal: roundCurrency(comparison.currentPeriod.spending.total),
      priorTotal: roundCurrency(comparison.priorPeriod.spending.total),
      delta: {
        direction: spendingDelta.direction,
        percent: spendingDelta.percent,
      },
    },
    income: {
      currentTotal: roundCurrency(comparison.currentPeriod.income.total),
      priorTotal: roundCurrency(comparison.priorPeriod.income.total),
      delta: {
        direction: incomeDelta.direction,
        percent: incomeDelta.percent,
      },
    },
    categoryChanges: buildCategoryBreakdownFromComparison(comparison).map(
      ({ category, currentTotal, priorTotal, spendingDelta: delta }) => ({
        category,
        currentTotal: roundCurrency(currentTotal),
        priorTotal: roundCurrency(priorTotal),
        delta:
          delta && !delta.isNewCategory
            ? { direction: delta.direction, percent: delta.percent }
            : delta?.isNewCategory
              ? { direction: 'new', percent: null }
              : null,
      })
    ),
  }
}

function buildAccountsSnapshot(rows) {
  const items = rows.map((account) => {
    const isLiability = isLiabilityAccount(account)

    return {
      bankName: account.bank_name,
      name: account.account_name,
      type: account.account_type,
      balance: roundCurrency(getDisplayBalance(account)),
      isCredit: isLiability,
      balanceMeaning: isLiability
        ? 'liability balance owed (higher = more debt)'
        : 'available cash (checking/savings) or investment value',
    }
  })

  return {
    netTotalBalance: roundCurrency(calculateTotalBalance(rows)),
    balanceNote:
      'Net total subtracts credit card, loan, and mortgage balances owed from cash/checking available balances',
    items,
  }
}

async function loadConnectedTransactionsForChat(userId) {
  const result = await db.query(
    `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       AND (t.pending IS NOT TRUE)
       AND t.date >= NOW() - $2::interval
     ORDER BY t.date DESC`,
    [userId, COMPARISON_PERIOD_INTERVAL]
  )

  return result.rows
}

async function loadDisconnectedTransactionStats(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM transactions t
     WHERE t.user_id = $1
       AND t.account_id IS NULL
       AND (t.pending IS NOT TRUE)
       AND t.date >= NOW() - $2::interval`,
    [userId, DISCONNECTED_LOOKBACK_INTERVAL]
  )

  return result.rows[0]?.count ?? 0
}

function buildDataScope(disconnectedTransactionCount) {
  return {
    transactionScope:
      'Expense Analyzer, month-over-month comparisons, and recent activity include only currently connected accounts',
    disconnectedAccountPolicy:
      'When a bank account is disconnected, its transactions are excluded from category breakdown, recurring detection, and live spending totals. Historical charges from disconnected accounts will not appear as recurring subscriptions.',
    disconnectedOrphanedTransactionCountLast90Days: disconnectedTransactionCount,
    recurringConfidenceTiers: {
      confirmedRecurring:
        'High confidence only — counted in subscription totals (UI label: Confirmed)',
      reviewRecurring:
        'Medium/low confidence or needs more history — shown in Review, NOT in confirmed totals (UI labels: Likely or Uncertain)',
    },
    comparisonWindow: 'Rolling 30-day windows (not calendar months)',
  }
}

async function loadLastSyncedAt(userId) {
  const result = await db.query(
    `SELECT MAX(last_synced_at) AS last_synced
     FROM (
       SELECT last_synced_at FROM accounts WHERE user_id = $1
       UNION ALL
       SELECT last_synced_at FROM plaid_items WHERE user_id = $1
     ) AS combined
     WHERE last_synced_at IS NOT NULL`,
    [userId]
  )

  return result.rows[0]?.last_synced ?? null
}

/*
 * loadChatFinancialContext(userId)
 *
 * Live financial snapshot for Ask Soverm — accounts, recent activity,
 * Expense Analyzer, plus PMF loop (weekly / month / memory / open actions).
 */
export async function loadChatFinancialContext(userId) {
  const [
    expenseAnalyzer,
    liveMonthOverMonth,
    connectedTransactions,
    accountsResult,
    disconnectedTransactionCount,
    lastSyncedAt,
  ] = await Promise.all([
    loadExpenseAnalyzerChatContext(userId),
    loadMonthOverMonthComparison(userId),
    loadConnectedTransactionsForChat(userId),
    db.query(
      `SELECT bank_name, account_name, account_type, balance_current, balance_available
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
    loadDisconnectedTransactionStats(userId),
    loadLastSyncedAt(userId),
  ])

  const liveMomSnapshot = buildLiveMonthOverMonthSnapshot(liveMonthOverMonth)
  const pmf = await loadChatPmfContext(userId, {
    liveMonthOverMonth: liveMomSnapshot,
  }).catch(() => ({
    weeklyReview: null,
    monthCondition: null,
    openActions: [],
    userMemory: null,
  }))

  const accounts = buildAccountsSnapshot(accountsResult.rows)
  const accountSummary = accounts.items
    .map(
      (account) =>
        `${account.bankName ? `${account.bankName} — ` : ''}${account.name} (${account.type}): $${account.balance}${account.isCredit ? ' owed' : ''}`
    )
    .join('\n')

  return {
    capturedAt: new Date().toISOString(),
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
    accounts,
    accountSummary,
    liveMonthOverMonth: liveMomSnapshot,
    recentActivity: buildRecentActivitySummary(connectedTransactions),
    expenseAnalyzer,
    dataScope: buildDataScope(disconnectedTransactionCount),
    weeklyReview: pmf.weeklyReview,
    monthCondition: pmf.monthCondition,
    openActions: pmf.openActions ?? [],
    userMemory: pmf.userMemory,
  }
}

export async function loadInsightActionsForChat(userId, insightId) {
  const result = await db.query(
    `SELECT description, completed
     FROM actions
     WHERE user_id = $1 AND insight_id = $2
     ORDER BY created_at ASC`,
    [userId, insightId]
  )

  return result.rows.map((row) => ({
    description: row.description,
    completed: Boolean(row.completed),
  }))
}
