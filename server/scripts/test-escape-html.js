/**
 * Smoke checks for escapeHtml.
 *
 * Usage: node scripts/test-escape-html.js
 */

import { escapeHtml } from '../utils/escapeHtml.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(escapeHtml('<script>') === '&lt;script&gt;', 'tags')
assert(escapeHtml('a & b') === 'a &amp; b', 'ampersand')
assert(escapeHtml('"hi"') === '&quot;hi&quot;', 'double quotes')
assert(escapeHtml("it's") === 'it&#39;s', 'single quotes')
assert(escapeHtml(null) === '', 'null')
assert(escapeHtml(undefined) === '', 'undefined')

console.log('test-escape-html: ok')
