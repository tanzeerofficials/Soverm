/**
 * Unit checks for month-end condition notify helpers (no DB required).
 *
 * Usage: node scripts/test-month-condition-notify.js
 */

import {
  closedMonthKeyForNotify,
  formatMonthConditionNotifyEmail,
  shouldNotifyClosedMonth,
} from '../services/monthConditionNotify.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('monthConditionNotify tests\n')

// July 1 2026 16:00 UTC ≈ still July 1 in America/New_York
const julyFirst = new Date('2026-07-01T16:00:00.000Z')
assert(shouldNotifyClosedMonth(julyFirst) === true, 'day 1 notifies')
assert(closedMonthKeyForNotify(julyFirst) === '2026-06', 'prior month is June')

const midMonth = new Date('2026-07-15T16:00:00.000Z')
assert(shouldNotifyClosedMonth(midMonth) === false, 'mid-month skips')

const sample = {
  email: 'alex@example.com',
  name: 'Alex Rivera',
  monthKey: '2026-06',
  monthLabel: 'June',
  gradeLabel: 'Tight',
  summary: 'Income covered spending, but the buffer is thin.',
  links: {
    monthCondition: 'http://localhost:5173/month-condition?month=2026-06',
    dashboard: 'http://localhost:5173/dashboard',
    settings: 'http://localhost:5173/settings',
  },
}

const formatted = formatMonthConditionNotifyEmail(sample)
assert(formatted.subject.includes('June'), 'subject mentions month')
assert(formatted.subject.includes('accountant letter'), 'subject mentions letter')
assert(formatted.text.includes('month-condition?month=2026-06'), 'deep-link')
assert(formatted.html.includes('Read your letter'), 'html CTA')

console.log('All monthConditionNotify tests passed.')
