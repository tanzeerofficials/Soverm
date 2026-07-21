/**
 * CSV escape / formula-injection smoke tests.
 *
 * Usage: node scripts/test-monthly-export-csv.js
 */

import { csvEscape } from '../utils/csvEscape.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(csvEscape('Coffee Shop') === 'Coffee Shop', 'plain text')
assert(csvEscape('Acme, Inc') === '"Acme, Inc"', 'comma quoting')
assert(csvEscape('=1+1') === "'=1+1", 'equals formula')
assert(csvEscape('+cmd') === "'+cmd", 'plus formula')
assert(csvEscape('-1+2') === "'-1+2", 'minus formula')
assert(csvEscape('@SUM(A1)') === "'@SUM(A1)", 'at formula')
assert(csvEscape('=Evil,"x"') === `"'=Evil,""x"""`, 'formula + quotes')

console.log('test-monthly-export-csv: ok')
