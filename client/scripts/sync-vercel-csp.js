/*
 * Syncs Content-Security-Policy into vercel.json from the shared allowlist.
 *
 * Usage:
 *   node scripts/sync-vercel-csp.js
 *   VITE_API_URL=https://api.example.com node scripts/sync-vercel-csp.js
 *
 * Run after changing contentSecurityPolicy.js (or before deploy if your API
 * origin is not covered by the Railway wildcards).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContentSecurityPolicyHeader } from '../src/lib/contentSecurityPolicy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vercelPath = join(__dirname, '..', 'vercel.json')

const extraConnectSrc = []
if (process.env.VITE_API_URL) {
  extraConnectSrc.push(process.env.VITE_API_URL)
}

const csp = buildContentSecurityPolicyHeader({ extraConnectSrc })

const existing = JSON.parse(readFileSync(vercelPath, 'utf8'))

const otherHeaders = (existing.headers ?? []).filter(
  (entry) => entry?.source !== '/(.*)' || !Array.isArray(entry.headers)
)

const documentHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const next = {
  ...existing,
  headers: [
    ...otherHeaders,
    {
      source: '/(.*)',
      headers: documentHeaders,
    },
  ],
}

writeFileSync(vercelPath, `${JSON.stringify(next, null, 2)}\n`)
console.log('Updated client/vercel.json Content-Security-Policy')
console.log(`  connect-src extras: ${extraConnectSrc.length ? extraConnectSrc.join(', ') : '(none)'}`)
