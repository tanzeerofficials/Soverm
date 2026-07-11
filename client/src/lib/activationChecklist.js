/*
 * ACTIVATION CHECKLIST (G5)
 *
 * Tracks the paycheck-to-paycheck activation path in user-scoped localStorage:
 * connected → payday → weekly review seen → action taken → month letter seen.
 */

import {
  readUserScopedJson,
  writeUserScopedJson,
} from './userScopedStorage.js'
import { trackActivationStep } from './analytics.js'

export const ACTIVATION_STORAGE_KEY = 'soverm:activation-checklist'

export const ACTIVATION_STEPS = [
  {
    id: 'connected',
    title: 'Connect a bank',
    detail: 'Link an account so Soverm can see balances and bills.',
    href: '/dashboard',
  },
  {
    id: 'payday',
    title: 'Confirm payday',
    detail: 'Unlock what’s left until you’re paid.',
    href: '/settings',
  },
  {
    id: 'weeklyReview',
    title: 'Open Your week',
    detail: 'See how you did, what’s left, and one better move.',
    href: '/weekly-review',
  },
  {
    id: 'actionTaken',
    title: 'Take one action',
    detail: 'Accept a weekly move, or keep/cancel a subscription flag.',
    href: '/weekly-review',
  },
  {
    id: 'monthLetter',
    title: 'Read a month letter',
    detail: 'Your accountant-style condition for the month.',
    href: '/month-condition',
  },
]

const DEFAULT_FLAGS = {
  weeklyReviewSeen: false,
  actionTaken: false,
  monthLetterSeen: false,
}

export function readActivationFlags(userId) {
  return {
    ...DEFAULT_FLAGS,
    ...readUserScopedJson(ACTIVATION_STORAGE_KEY, userId, DEFAULT_FLAGS),
  }
}

export function writeActivationFlags(userId, patch) {
  const next = {
    ...readActivationFlags(userId),
    ...patch,
  }
  writeUserScopedJson(ACTIVATION_STORAGE_KEY, userId, next)
  return next
}

export function markActivationStep(userId, stepId) {
  if (!userId || !stepId) {
    return readActivationFlags(userId)
  }

  const flags = readActivationFlags(userId)
  const patch = {}

  if (stepId === 'weeklyReview' && !flags.weeklyReviewSeen) {
    patch.weeklyReviewSeen = true
  }
  if (stepId === 'actionTaken' && !flags.actionTaken) {
    patch.actionTaken = true
  }
  if (stepId === 'monthLetter' && !flags.monthLetterSeen) {
    patch.monthLetterSeen = true
  }

  if (Object.keys(patch).length === 0) {
    return flags
  }

  const next = writeActivationFlags(userId, patch)
  trackActivationStep(stepId)
  return next
}

/**
 * Build checklist rows from live account/payday state + stored flags.
 */
export function buildActivationChecklist({
  userId,
  hasAccounts = false,
  paydayConfigured = false,
} = {}) {
  const flags = readActivationFlags(userId)

  const doneById = {
    connected: Boolean(hasAccounts),
    payday: Boolean(paydayConfigured),
    weeklyReview: Boolean(flags.weeklyReviewSeen),
    actionTaken: Boolean(flags.actionTaken),
    monthLetter: Boolean(flags.monthLetterSeen),
  }

  const steps = ACTIVATION_STEPS.map((step) => ({
    ...step,
    done: Boolean(doneById[step.id]),
  }))

  const completedCount = steps.filter((step) => step.done).length
  const nextStep = steps.find((step) => !step.done) ?? null
  const isComplete = completedCount === steps.length

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    nextStep,
    isComplete,
  }
}
