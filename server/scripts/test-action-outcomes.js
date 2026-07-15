/*
 * Unit tests for action outcome verification.
 */

import {
  mapStatusToCompleted,
  statusFromCompleted,
  verifyActionOutcome,
} from '../utils/actionOutcomes.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('actionOutcomes tests\n')

assert(mapStatusToCompleted('done') === true, 'done completed')
assert(mapStatusToCompleted('accepted') === false, 'accepted not completed')
assert(statusFromCompleted(true) === 'done', 'completed -> done')
assert(statusFromCompleted(false, 'done') === 'accepted', 'uncomplete done -> accepted')

const skipped = verifyActionOutcome(
  { description: 'Hold dining', status: 'skipped' },
  {}
)
assert(skipped.result === 'skipped', 'skipped')
assert(skipped.stillRelevant === true, 'skipped still relevant')

const improved = verifyActionOutcome(
  {
    description: 'Cap Dining',
    status: 'accepted',
    metadata: { category: 'Food and Drink', moveId: 'review-category-limit' },
  },
  {
    categorySpendThisWeek: 40,
    categorySpendPriorWeek: 90,
  }
)
assert(improved.result === 'improved', `improved got ${improved.result}`)

const pace = verifyActionOutcome(
  {
    description: 'Protect essentials',
    status: 'accepted',
    metadata: { moveId: 'protect-essentials' },
  },
  { spentThisWeek: 100, spentPriorWeek: 180 }
)
assert(pace.result === 'improved', `pace improved ${pace.result}`)

const billCancel = verifyActionOutcome(
  {
    description: 'Reminder: cancel Netflix yourself',
    status: 'accepted',
    metadata: { kind: 'bill_defense', decision: 'cancel', merchant: 'Netflix' },
  },
  {}
)
assert(billCancel.result === 'in_progress', 'bill cancel in progress')
assert(
  billCancel.summary.includes('cancel Netflix yourself'),
  'bill cancel summary is honest'
)
assert(
  billCancel.summary.includes("can’t cancel with the company"),
  'bill cancel clarifies no merchant cancel'
)

console.log('All actionOutcomes tests passed.')
