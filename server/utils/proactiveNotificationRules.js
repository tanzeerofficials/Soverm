import { calculateTotalBalance } from './balanceHelpers.js'
import { normalizeMerchantName } from './merchantNormalize.js'
import {
  DEFAULT_SPENDING_CAP_WARNING_PERCENT,
  isSpendingCapWarningActive,
  resolveSpendingAlertThresholds,
} from './monthlyTrackers.js'

export const TRIGGER_TYPES = {
  LARGE_TRANSACTION: 'large_transaction',
  LOW_BALANCE: 'low_balance',
  NEW_RECURRING_CHARGE: 'new_recurring_charge',
  SPENDING_SPIKE: 'spending_spike',
  SPENDING_CAP_OVER: 'spending_cap_over',
  SPENDING_CAP_WARNING: 'spending_cap_warning',
}

export const LARGE_TRANSACTION_MIN_ABSOLUTE = 500
export const LARGE_TRANSACTION_MULTIPLIER = 3
export const LOW_BALANCE_RUNWAY_DAYS = 4
export const SPENDING_SPIKE_PERCENT = 40
/** @deprecated Prefer resolveSpendingAlertThresholds / isSpendingCapWarningActive */
/** @deprecated Prefer resolveSpendingAlertThresholds / isSpendingCapWarningActive */
export const SPENDING_CAP_WARNING_PERCENT = DEFAULT_SPENDING_CAP_WARNING_PERCENT
export const DEDUP_LOOKBACK_DAYS = 7
export const MAX_NOTIFICATIONS_PER_SYNC = 2
export const MAX_NOTIFICATIONS_PER_DAY = 2
export const MAX_PER_TRIGGER_TYPE_PER_DAY = 1

const TRIGGER_PRIORITY = [
  TRIGGER_TYPES.LOW_BALANCE,
  TRIGGER_TYPES.SPENDING_CAP_OVER,
  TRIGGER_TYPES.SPENDING_CAP_WARNING,
  TRIGGER_TYPES.LARGE_TRANSACTION,
  TRIGGER_TYPES.NEW_RECURRING_CHARGE,
  TRIGGER_TYPES.SPENDING_SPIKE,
]

function roundCurrency(amount) {
  return Math.round(Number(amount) * 100) / 100
}

function averageTransactionAmount(transactions) {
  const amounts = transactions
    .map((row) => Number(row.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0)

  if (amounts.length === 0) {
    return 0
  }

  return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
}

function isLargeTransaction(amount, averageAmount) {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return false
  }

  if (numericAmount >= LARGE_TRANSACTION_MIN_ABSOLUTE) {
    return true
  }

  if (averageAmount <= 0) {
    return false
  }

  return numericAmount >= averageAmount * LARGE_TRANSACTION_MULTIPLIER
}

export function detectLargeTransactionTriggers({ recentTransactions = [] }) {
  const spending = recentTransactions.filter((row) => Number(row.amount) > 0)
  const averageAmount = averageTransactionAmount(spending)
  const triggers = []

  for (const row of spending) {
    if (!isLargeTransaction(row.amount, averageAmount)) {
      continue
    }

    triggers.push({
      triggerType: TRIGGER_TYPES.LARGE_TRANSACTION,
      dedupKey: `txn:${row.id ?? `${row.date}:${row.name}:${row.amount}`}`,
      relatedData: {
        transactionId: row.id ?? null,
        merchant: row.name,
        amount: roundCurrency(row.amount),
        category: row.category || 'Uncategorized',
        date: row.date,
        accountLabel: row.account_name || row.bank_name || null,
        averageTransactionAmount: roundCurrency(averageAmount),
        link: '/expense-analyzer?tab=overview',
      },
      facts: {
        merchant: row.name,
        amount: roundCurrency(row.amount),
        category: row.category || 'Uncategorized',
        averageTransactionAmount: roundCurrency(averageAmount),
      },
    })
  }

  return triggers.sort((left, right) => right.facts.amount - left.facts.amount)
}

export function detectLowBalanceTrigger({ accounts = [], monthOverMonth = null }) {
  const netBalance = roundCurrency(calculateTotalBalance(accounts))
  const monthlySpend = Number(monthOverMonth?.currentPeriod?.spending?.total ?? 0)
  const dailyBurn = monthlySpend > 0 ? monthlySpend / 30 : 0
  const runwayDays =
    dailyBurn > 0 ? Math.round((netBalance / dailyBurn) * 10) / 10 : null

  const isOverdraft = netBalance < 0
  const isLowRunway =
    runwayDays != null && runwayDays > 0 && runwayDays < LOW_BALANCE_RUNWAY_DAYS

  if (!isOverdraft && !isLowRunway) {
    return []
  }

  return [
    {
      triggerType: TRIGGER_TYPES.LOW_BALANCE,
      dedupKey: 'balance:runway',
      relatedData: {
        netBalance,
        runwayDays,
        dailyBurn: roundCurrency(dailyBurn),
        monthlySpend: roundCurrency(monthlySpend),
        link: '/dashboard?focus=balance',
      },
      facts: {
        netBalance,
        runwayDays,
        dailyBurn: roundCurrency(dailyBurn),
        isOverdraft,
      },
    },
  ]
}

export function detectNewRecurringChargeTriggers({
  recurringCharges = [],
  previouslyNotifiedMerchants = new Set(),
}) {
  const triggers = []

  for (const charge of recurringCharges) {
    const merchantKey = normalizeMerchantName(charge.merchant)

    if (!merchantKey || previouslyNotifiedMerchants.has(merchantKey)) {
      continue
    }

    const occurrenceCount = Number(charge.occurrenceCount ?? 0)
    const lastChargedDate = charge.lastChargedDate
    const lastChargeMs = lastChargedDate ? Date.parse(`${lastChargedDate}T12:00:00`) : NaN
    const recentlyActive =
      Number.isFinite(lastChargeMs) &&
      Date.now() - lastChargeMs <= 35 * 24 * 60 * 60 * 1000

    if (occurrenceCount > 4 || !recentlyActive) {
      continue
    }

    triggers.push({
      triggerType: TRIGGER_TYPES.NEW_RECURRING_CHARGE,
      dedupKey: `merchant:${merchantKey}`,
      relatedData: {
        merchant: charge.merchant,
        merchantKey,
        monthlyEquivalent: charge.monthlyEquivalent,
        annualEquivalent: roundCurrency((charge.monthlyEquivalent ?? 0) * 12),
        category: charge.category,
        source: charge.source,
        confidence: charge.confidence,
        link: '/expense-analyzer?tab=recurring',
      },
      facts: {
        merchant: charge.merchant,
        monthlyEquivalent: charge.monthlyEquivalent,
        annualEquivalent: roundCurrency((charge.monthlyEquivalent ?? 0) * 12),
        category: charge.category,
      },
    })
  }

  return triggers
}

export function detectSpendingSpikeTriggers({ categoryBreakdown = [] }) {
  const triggers = []

  for (const entry of categoryBreakdown) {
    const delta = entry.delta ?? entry.spendingDelta

    if (!delta || delta.direction !== 'up' || delta.percent == null) {
      continue
    }

    if (delta.percent < SPENDING_SPIKE_PERCENT) {
      continue
    }

    const categoryKey = entry.category || 'Uncategorized'

    triggers.push({
      triggerType: TRIGGER_TYPES.SPENDING_SPIKE,
      dedupKey: `category:${categoryKey}`,
      relatedData: {
        category: categoryKey,
        currentTotal: entry.currentTotal,
        priorTotal: entry.priorTotal,
        percent: delta.percent,
        link: '/expense-analyzer?tab=categories',
      },
      facts: {
        category: categoryKey,
        currentTotal: entry.currentTotal,
        priorTotal: entry.priorTotal,
        percent: delta.percent,
      },
    })
  }

  return triggers.sort((left, right) => right.facts.percent - left.facts.percent)
}

export function detectSpendingCapTriggers({ spendingTracker = null, periodStart = null } = {}) {
  const progress = spendingTracker?.progress

  if (!progress || !spendingTracker?.monthlyAmount) {
    return []
  }

  const periodKey = periodStart ?? 'current-month'
  const capName = spendingTracker.name || 'Spending cap'
  const limit = roundCurrency(spendingTracker.monthlyAmount)
  const spent = roundCurrency(progress.spent)
  const triggers = []

  const thresholds = resolveSpendingAlertThresholds(spendingTracker)
  const remaining = roundCurrency(progress.remaining)

  if (progress.isOver) {
    triggers.push({
      triggerType: TRIGGER_TYPES.SPENDING_CAP_OVER,
      dedupKey: `spending_cap:over:${periodKey}`,
      relatedData: {
        trackerId: spendingTracker.id ?? null,
        capName,
        monthlyLimit: limit,
        spent,
        overBy: roundCurrency(progress.overBy),
        percentUsed: progress.percentUsed,
        link: '/dashboard?tab=tools&quickTool=tracker',
      },
      facts: {
        capName,
        monthlyLimit: limit,
        spent,
        overBy: roundCurrency(progress.overBy),
        percentUsed: progress.percentUsed,
      },
    })
  } else if (isSpendingCapWarningActive(spendingTracker, progress)) {
    triggers.push({
      triggerType: TRIGGER_TYPES.SPENDING_CAP_WARNING,
      dedupKey: `spending_cap:warning:${periodKey}`,
      relatedData: {
        trackerId: spendingTracker.id ?? null,
        capName,
        monthlyLimit: limit,
        spent,
        remaining,
        percentUsed: progress.percentUsed,
        warningPercent: thresholds.warningPercent,
        remainingDollarsThreshold: thresholds.remainingDollars,
        link: '/dashboard?tab=tools&quickTool=tracker',
      },
      facts: {
        capName,
        monthlyLimit: limit,
        spent,
        remaining,
        percentUsed: progress.percentUsed,
        warningPercent: thresholds.warningPercent,
        remainingDollarsThreshold: thresholds.remainingDollars,
      },
    })
  }

  return triggers
}

export function evaluateProactiveTriggers(context) {
  const candidates = [
    ...detectLowBalanceTrigger(context),
    ...detectSpendingCapTriggers(context),
    ...detectLargeTransactionTriggers(context),
    ...detectNewRecurringChargeTriggers(context),
    ...detectSpendingSpikeTriggers(context),
  ]

  const byPriority = TRIGGER_PRIORITY.flatMap((type) =>
    candidates.filter((candidate) => candidate.triggerType === type)
  )

  return byPriority
}

export function buildTemplateNotificationCopy(trigger) {
  switch (trigger.triggerType) {
    case TRIGGER_TYPES.LARGE_TRANSACTION:
      return {
        title: 'Unusual charge detected',
        body: `${trigger.facts.merchant} for $${trigger.facts.amount} stands out — well above your typical transaction size.`,
      }
    case TRIGGER_TYPES.LOW_BALANCE:
      if (trigger.facts.isOverdraft) {
        return {
          title: 'Balance is negative',
          body: `Your connected accounts net to $${trigger.facts.netBalance}. Worth checking before more charges hit.`,
        }
      }
      return {
        title: 'Cash runway is getting tight',
        body: `At your recent spending pace, you have about ${trigger.facts.runwayDays} days of runway on $${trigger.facts.netBalance} in connected accounts.`,
      }
    case TRIGGER_TYPES.NEW_RECURRING_CHARGE:
      return {
        title: 'New subscription detected',
        body: `${trigger.facts.merchant} looks like a new recurring charge — about $${trigger.facts.monthlyEquivalent}/mo ($${trigger.facts.annualEquivalent}/year).`,
      }
    case TRIGGER_TYPES.SPENDING_SPIKE:
      return {
        title: 'Spending spike in a category',
        body: `${trigger.facts.category} is up ${trigger.facts.percent}% vs the prior 30 days ($${trigger.facts.currentTotal} vs $${trigger.facts.priorTotal}).`,
      }
    case TRIGGER_TYPES.SPENDING_CAP_OVER:
      return {
        title: 'Spending cap exceeded',
        body: `${trigger.facts.capName} is over for this month — $${trigger.facts.spent} spent vs $${trigger.facts.monthlyLimit} limit.`,
      }
    case TRIGGER_TYPES.SPENDING_CAP_WARNING: {
      const remainingNote =
        trigger.facts.remainingDollarsThreshold != null
          ? ` $${trigger.facts.remaining} left (alert at $${trigger.facts.remainingDollarsThreshold}).`
          : ` $${trigger.facts.remaining} left.`
      return {
        title: 'Approaching your spending cap',
        body: `${trigger.facts.capName} is at ${trigger.facts.percentUsed}% ($${trigger.facts.spent} of $${trigger.facts.monthlyLimit}).${remainingNote}`,
      }
    }
    default:
      return {
        title: 'Soverm noticed something',
        body: 'Open your dashboard for details on a recent change in your finances.',
      }
  }
}
