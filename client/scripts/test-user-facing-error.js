/*
 * Verifies toUserFacingErrorMessage keeps API copy and hides network jargon.
 *
 * Usage: node scripts/test-user-facing-error.js
 */

import { toUserFacingErrorMessage } from '../src/lib/userFacingError.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const fallback = 'Couldn’t save category limit'

assert(
  toUserFacingErrorMessage(new Error('Failed to fetch'), fallback) === fallback,
  'Failed to fetch → fallback'
)
assert(
  toUserFacingErrorMessage(new Error('NetworkError when attempting to fetch resource.'), fallback) ===
    fallback,
  'NetworkError → fallback'
)
assert(
  toUserFacingErrorMessage(new Error('Category limit save failed: 500'), fallback) === fallback,
  'status-code tail → fallback'
)
assert(
  toUserFacingErrorMessage(new Error('Monthly limit must be at least $1'), fallback) ===
    'Monthly limit must be at least $1',
  'API message preserved'
)
assert(
  toUserFacingErrorMessage(null, fallback) === fallback,
  'null err → fallback'
)
assert(
  toUserFacingErrorMessage(new Error(''), fallback) === fallback,
  'empty message → fallback'
)

console.log('userFacingError tests passed')
