/**
 * Smoke check that syncAllAccountsForUser is wrapped in a per-user advisory lock.
 *
 * Usage: node scripts/test-plaid-sync-lock.js
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PLAID_SYNC_LOCK_NAMESPACE } from '../utils/userPlaidSyncLock.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const plaidSource = readFileSync(join(__dirname, '../services/plaid.js'), 'utf8')
const lockSource = readFileSync(join(__dirname, '../utils/userPlaidSyncLock.js'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(plaidSource.includes('withUserPlaidSyncLock'), 'plaid sync uses withUserPlaidSyncLock')
assert(plaidSource.includes('runSyncAllAccountsForUser'), 'inner sync function exists')
assert(lockSource.includes('pg_advisory_lock'), 'advisory lock acquired')
assert(lockSource.includes('pg_advisory_unlock'), 'advisory lock released')
assert(Number.isInteger(PLAID_SYNC_LOCK_NAMESPACE), 'lock namespace is an int')

console.log('test-plaid-sync-lock: ok')
