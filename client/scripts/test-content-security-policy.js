/*
 * CSP allowlist unit tests.
 *
 * Usage: node scripts/test-content-security-policy.js
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildContentSecurityPolicyHeader,
  buildCspDirectives,
} from '../src/lib/contentSecurityPolicy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('contentSecurityPolicy tests\n')

const header = buildContentSecurityPolicyHeader()
assert.match(header, /default-src 'self'/)
assert.match(header, /cdn\.plaid\.com/)
assert.match(header, /challenges\.cloudflare\.com/)
assert.match(header, /img\.clerk\.com/)
assert.match(header, /fonts\.googleapis\.com/)
assert.match(header, /\*\.up\.railway\.app/)
assert.match(header, /object-src 'none'/)
assert.match(header, /frame-ancestors 'none'/)
assert.doesNotMatch(header, /unsafe-eval/)
console.log('  pass: production CSP header shape')

const withApi = buildContentSecurityPolicyHeader({
  extraConnectSrc: ['https://api.soverm.example'],
})
assert.match(withApi, /https:\/\/api\.soverm\.example/)
console.log('  pass: extra API origin merges into connect-src')

const directives = buildCspDirectives()
assert.ok(directives['style-src'].includes("'unsafe-inline'"), 'Clerk needs style unsafe-inline')
assert.ok(directives['worker-src'].includes('blob:'), 'Clerk needs blob workers')
console.log('  pass: Clerk-required directives present')

const vercel = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'))
const cspHeader = vercel.headers
  ?.flatMap((block) => block.headers || [])
  ?.find((h) => h.key === 'Content-Security-Policy')
assert.ok(cspHeader?.value, 'vercel.json must include CSP header')
assert.match(cspHeader.value, /cdn\.plaid\.com/)
assert.match(cspHeader.value, /clerk/)
console.log('  pass: vercel.json CSP is synced')

console.log('\nAll contentSecurityPolicy tests passed.')
