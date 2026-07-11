/*
 * Unit tests for calendar week + weekly review pure helpers.
 */

import { getCalendarWeekWindow } from '../utils/calendarWeek.js'
import {
  buildHowYouDid,
  pickOneMove,
  pickOneRisk,
} from '../utils/weeklyReview.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('weeklyReview tests\n')

// Wednesday 2026-05-13 → week Mon 11 – Sun 17
const week = getCalendarWeekWindow(new Date('2026-05-13T18:00:00Z'))
assert(week.weekStartIso === '2026-05-11', `week start ${week.weekStartIso}`)
assert(week.weekEndIso === '2026-05-17', `week end ${week.weekEndIso}`)
assert(week.priorWeekStartIso === '2026-05-04', `prior start ${week.priorWeekStartIso}`)
assert(week.label.includes('May'), `label ${week.label}`)

const how = buildHowYouDid({
  spentThisWeek: 220,
  spentPriorWeek: 200,
  topCategories: [{ category: 'Food and Drink', amount: 90 }],
})
assert(how.direction === 'up', 'direction up')
assert(how.summary.includes('Food and Drink'), 'mentions driver')

const sparse = buildHowYouDid({ spentThisWeek: 40, sparse: true })
assert(sparse.summary.includes('learning') || sparse.summary.includes('Not enough'), 'sparse copy')

const riskOver = pickOneRisk({
  categorySoftLimits: [
    {
      category: 'Dining',
      isOver: true,
      isWarning: false,
      spentThisMonth: 500,
      monthlyLimit: 400,
      percentUsed: 125,
    },
  ],
  whatsLeft: { configured: true, amount: 200, bills: [] },
})
assert(riskOver.id.includes('category-over'), 'category over wins')

const movePayday = pickOneMove({ paydayConfigured: false })
assert(movePayday.id === 'confirm-payday', 'prompt payday')

const moveHold = pickOneMove({
  paydayConfigured: true,
  whatsLeft: { configured: true, amount: 80, daysUntilPayday: 5 },
  risk: { id: 'all-clear' },
})
assert(moveHold.id === 'hold-steady' || moveHold.id === 'park-small-buffer', `move ${moveHold.id}`)

console.log('All weeklyReview tests passed.')
