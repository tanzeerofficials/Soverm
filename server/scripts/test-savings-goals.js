/**
 * Unit tests for savings goal helpers.
 * Run: node scripts/test-savings-goals.js
 */

import {
  mapSavingsGoalRow,
  parseCreateGoalInput,
  sumPlannedGoalsMonthly,
} from '../utils/savingsGoals.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('savingsGoals tests\n')

const parsed = parseCreateGoalInput({
  name: '  Laptop fund ',
  purposeType: 'purchase',
  monthlyAmount: 150,
  targetTotal: 1200,
})
assert(parsed.value.name === 'Laptop fund', 'trims goal name')
assert(parsed.value.monthlyAmount === 150, 'parses monthly amount')

const invalid = parseCreateGoalInput({ name: '', monthlyAmount: 50 })
assert(invalid.error, 'rejects empty name')

const mapped = mapSavingsGoalRow({
  id: 'abc',
  name: 'Debt',
  purpose_type: 'debt',
  monthly_amount: 300,
  target_total: 1000,
  saved_so_far: 250,
  active: true,
  created_at: new Date(),
  updated_at: new Date(),
})
assert(mapped.progressPercent === 25, 'computes target progress')
assert(mapped.purposeType === 'debt', 'maps purpose type')

const total = sumPlannedGoalsMonthly([
  { monthly_amount: 300 },
  { monthly_amount: 150 },
])
assert(total === 450, 'sums planned monthly goals')

console.log('All savingsGoals tests passed.')
