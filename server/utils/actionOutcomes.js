/*
 * ACTION OUTCOME VERIFICATION (pure)
 *
 * Lightweight checks for closed-loop follow-up in Weekly Review.
 */

import { roundCurrency } from './safeToSpend.js'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

export const ACTION_STATUSES = ['suggested', 'accepted', 'done', 'skipped', 'dismissed']

/**
 * Verify how an accepted/done action went given spend snapshots.
 *
 * @param {object} action
 * @param {{
 *   spentThisWeek?: number,
 *   spentPriorWeek?: number,
 *   categorySpendThisWeek?: number | null,
 *   categorySpendPriorWeek?: number | null,
 * }} context
 */
export function verifyActionOutcome(action, context = {}) {
  const status = action.status ?? (action.completed ? 'done' : 'suggested')
  const metadata = action.metadata ?? {}
  const moveId = metadata.moveId ?? null

  if (status === 'skipped' || status === 'dismissed') {
    return {
      tone: 'neutral',
      result: 'skipped',
      summary: `You skipped “${action.description}”. Still relevant this week?`,
      stillRelevant: true,
    }
  }

  if (status === 'suggested') {
    return {
      tone: 'neutral',
      result: 'pending',
      summary: `Still suggested: “${action.description}”.`,
      stillRelevant: true,
    }
  }

  const spentThisWeek = roundCurrency(context.spentThisWeek ?? 0)
  const spentPriorWeek = roundCurrency(context.spentPriorWeek ?? 0)
  const catThis = context.categorySpendThisWeek
  const catPrior = context.categorySpendPriorWeek

  if (catThis != null && catPrior != null && catPrior > 0) {
    const delta = roundCurrency(catThis - catPrior)
    if (delta < -5) {
      return {
        tone: 'brand',
        result: 'improved',
        summary: `Last week’s action helped: that category is down ${formatMoney(Math.abs(delta))} vs the week before.`,
        stillRelevant: false,
      }
    }
    if (delta > 5) {
      return {
        tone: 'warning',
        result: 'worsened',
        summary: `That category rose ${formatMoney(delta)} vs the prior week — worth another look.`,
        stillRelevant: true,
      }
    }
    return {
      tone: 'neutral',
      result: 'flat',
      summary: `That category is about flat week over week (${formatMoney(catThis)}).`,
      stillRelevant: status === 'accepted',
    }
  }

  if (spentPriorWeek > 0) {
    const delta = roundCurrency(spentThisWeek - spentPriorWeek)
    if (moveId === 'protect-essentials' || moveId === 'slow-pace' || moveId === 'slow-discretionary') {
      if (delta < -10) {
        return {
          tone: 'brand',
          result: 'improved',
          summary: `Nice — overall spend is down ${formatMoney(Math.abs(delta))} vs last week after you took that action.`,
          stillRelevant: false,
        }
      }
      if (delta > 20) {
        return {
          tone: 'warning',
          result: 'worsened',
          summary: `Spend is up ${formatMoney(delta)} vs last week. The same move may still matter.`,
          stillRelevant: true,
        }
      }
    }
  }

  if (status === 'done') {
    return {
      tone: 'brand',
      result: 'done',
      summary: `You marked “${action.description}” done. Keep the habit going this week.`,
      stillRelevant: false,
    }
  }

  return {
    tone: 'neutral',
    result: 'in_progress',
    summary: `You accepted “${action.description}”. How’s it going — mark done when finished?`,
    stillRelevant: true,
  }
}

export function mapStatusToCompleted(status) {
  return status === 'done'
}

export function statusFromCompleted(completed, previousStatus = 'suggested') {
  if (completed) {
    return 'done'
  }
  if (previousStatus === 'done') {
    return 'accepted'
  }
  return previousStatus === 'suggested' ? 'suggested' : previousStatus
}
