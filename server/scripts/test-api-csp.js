/*
 * API CSP / Helmet config tests.
 *
 * Usage: node scripts/test-api-csp.js
 */

import assert from 'node:assert/strict'
import { buildApiContentSecurityPolicy } from '../utils/contentSecurityPolicy.js'
import { test } from 'node:test'

test('api csp', () => {
  console.log('API CSP tests\n')

  const policy = buildApiContentSecurityPolicy()
  assert.equal(policy.useDefaults, false)
  assert.deepEqual(policy.directives.defaultSrc, ["'none'"])
  assert.deepEqual(policy.directives.frameAncestors, ["'none'"])
  assert.equal(policy.reportOnly, false)

  const reportOnly = buildApiContentSecurityPolicy({ reportOnly: true })
  assert.equal(reportOnly.reportOnly, true)

  console.log('  pass: API CSP is strict JSON-safe policy')
  console.log('\nAll API CSP tests passed.')
})
