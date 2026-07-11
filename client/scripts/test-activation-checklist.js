/**
 * Unit tests for activation checklist helpers (G5).
 * Run: node scripts/test-activation-checklist.js
 */

import {
  ACTIVATION_STEPS,
  buildActivationChecklist,
} from '../src/lib/activationChecklist.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('activationChecklist tests\n')

assert(ACTIVATION_STEPS.length === 5, 'five activation steps')

const empty = buildActivationChecklist({
  userId: null,
  hasAccounts: false,
  paydayConfigured: false,
})
assert(empty.completedCount === 0, 'empty starts at 0')
assert(empty.nextStep?.id === 'connected', 'next is connect')

const mid = buildActivationChecklist({
  userId: null,
  hasAccounts: true,
  paydayConfigured: true,
})
assert(mid.completedCount === 2, 'connected + payday')
assert(mid.nextStep?.id === 'weeklyReview', 'next is weekly')

console.log('All activationChecklist tests passed.')
