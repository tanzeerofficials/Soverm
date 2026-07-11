/*
 * BEFORE YOU SPEND SERVICE
 *
 * Loads tracker / soft-limit context and runs the pure judgment helper.
 */

import { judgeBeforeYouSpend } from '../utils/beforeYouSpend.js'
import { buildTrackerSnapshotWithFallback } from './trackerSnapshot.js'
import { listCategorySoftLimits } from './categorySoftLimits.js'

export async function evaluateBeforeYouSpendForUser(
  userId,
  { amount, category = null } = {}
) {
  const spend = Number(amount)
  if (!Number.isFinite(spend) || spend <= 0) {
    const error = new Error('amount must be a positive number')
    error.statusCode = 400
    throw error
  }

  const [snapshot, softLimits] = await Promise.all([
    buildTrackerSnapshotWithFallback(userId).catch(() => null),
    listCategorySoftLimits(userId).catch(() => []),
  ])

  const judgment = judgeBeforeYouSpend({
    amount: spend,
    category,
    whatsLeft: snapshot?.whatsLeftUntilPayday ?? null,
    softLimits: softLimits ?? snapshot?.categorySoftLimits ?? [],
    safeToSpend: snapshot?.safeToSpend ?? null,
    spendingCapConfigured: Boolean(snapshot?.configured),
  })

  return {
    ...judgment,
    context: {
      paydayConfigured: Boolean(snapshot?.payday?.configured),
      whatsLeft: snapshot?.whatsLeftUntilPayday?.configured
        ? {
            amount: snapshot.whatsLeftUntilPayday.amount,
            daysUntilPayday: snapshot.whatsLeftUntilPayday.daysUntilPayday,
            nextPaydayOn: snapshot.whatsLeftUntilPayday.nextPaydayOn,
            billsUntilPaydayTotal:
              snapshot.whatsLeftUntilPayday.billsUntilPaydayTotal,
          }
        : null,
      softLimitCount: (softLimits ?? []).length,
    },
  }
}
