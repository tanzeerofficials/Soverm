/*
 * Verifies calm top-mover copy (inform, don’t alarm).
 *
 * Usage: node scripts/test-top-mover-copy.js
 */

import {
  buildTopMoverHeadline,
  topMoverHeadlineStyles,
} from '../src/lib/topMover.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

try {
  console.log('Top mover copy tests\n')

  const up = buildTopMoverHeadline({
    category: 'Personal Care',
    direction: 'up',
    percent: 1972,
    currentTotal: 525.35,
    priorTotal: 25.35,
  })

  assert(up.includes('Worth a quick look'), 'up copy leads with worth a look')
  assert(up.includes('$525.35'), 'up copy includes current amount')
  assert(up.includes('$25.35'), 'up copy includes prior amount')
  assert(up.includes('heads-up') || up.includes('when you have a minute'), 'up copy softens alarm')
  assert(!up.includes('crisis'), 'up copy avoids crisis language')
  assert(!up.includes('21×') && !up.includes('fastest-growing'), 'up copy avoids scare multipliers')

  const down = buildTopMoverHeadline({
    category: 'Dining',
    direction: 'down',
    percent: 40,
    currentTotal: 120,
    priorTotal: 200,
  })
  assert(down.includes('quieter'), 'down copy is encouraging')

  assert(topMoverHeadlineStyles('up').badgeVariant === 'heads_up', 'up uses heads_up badge')
  assert(topMoverHeadlineStyles('down').badgeVariant === 'improvement', 'down uses improvement')

  console.log('  pass: calm category copy')
  console.log('\nAll top mover copy checks passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
