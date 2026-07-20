/*
 * Verifies InsightCard badge tone logic for income vs spending (no DOM).
 *
 * Usage: node scripts/test-badge-tone-logic.js
 */

import { toneForChange } from '../src/lib/insightDisplay.js'

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

try {
  console.log('Badge tone logic tests (insightDisplay.js)\n')

  assertEqual(toneForChange('spending', 'up'), 'negative', 'spending up = red')
  assertEqual(toneForChange('spending', 'down'), 'positive', 'spending down = green')
  console.log('  pass: spending badges — up=red, down=green')

  assertEqual(toneForChange('income', 'up'), 'positive', 'income up = green')
  assertEqual(toneForChange('income', 'down'), 'negative', 'income down = red')
  console.log('  pass: income badges — up=green, down=red (inverted)')

  assertEqual(toneForChange('neutral', 'up'), 'neutral', 'neutral up = gray')
  assertEqual(toneForChange('income', 'up', true), 'positive', 'income new = green')
  assertEqual(toneForChange('spending', 'up', true), 'negative', 'spending new = red')
  console.log('  pass: neutral + new-category tones')

  const passed = 3
  console.log(`\n${passed}/${passed} tone groups verified`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
