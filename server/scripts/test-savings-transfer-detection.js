/**
 * Unit tests for savings transfer detection helpers.
 *
 * Usage: node scripts/test-savings-transfer-detection.js
 */

import {
  dedupeTransferCandidates,
  detectSavingsTransferCandidates,
  isCheckingTransferToSavings,
  isSavingsInflowTransaction,
  suggestTrackerForDetection,
} from '../utils/savingsTransferDetection.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log('savingsTransferDetection tests\n')

const savingsAccount = { account_type: 'savings', account_name: 'High Yield Savings', bank_name: 'Ally' }
const checkingAccount = { account_type: 'checking', account_name: 'Checking', bank_name: 'Chase' }

assert(
  isSavingsInflowTransaction(
    { amount: -250, name: 'Transfer from Checking', date: '2026-07-05', pending: false },
    savingsAccount
  ),
  'savings inflow detected'
)

assert(
  !isSavingsInflowTransaction(
    { amount: 5, name: 'Interest Payment', date: '2026-07-05', pending: false },
    savingsAccount
  ),
  'interest excluded'
)

assert(
  isCheckingTransferToSavings(
    { amount: 250, name: 'Online Transfer to Savings', date: '2026-07-05', pending: false },
    checkingAccount
  ),
  'checking transfer label detected'
)

const transactions = [
  {
    id: 'txn-savings',
    account_id: 'acct-1',
    amount: -250,
    name: 'Transfer from Checking',
    date: '2026-07-05',
    pending: false,
  },
  {
    id: 'txn-checking',
    account_id: 'acct-2',
    amount: 250,
    name: 'Online Transfer to Savings',
    date: '2026-07-05',
    pending: false,
  },
]

const accountsById = new Map([
  ['acct-1', savingsAccount],
  ['acct-2', checkingAccount],
])

const candidates = detectSavingsTransferCandidates(transactions, accountsById)
assert(candidates.length === 1, 'duplicate transfer pair deduped to one candidate')
assert(candidates[0].transactionId === 'txn-savings', 'prefers savings inflow side')

const deduped = dedupeTransferCandidates([
  { date: '2026-07-05', amount: 250, signal: 'checking_transfer', merchantName: 'A' },
  { date: '2026-07-05', amount: 250, signal: 'savings_inflow', merchantName: 'B' },
])
assert(deduped[0].signal === 'savings_inflow', 'dedupe prefers savings inflow')

const suggested = suggestTrackerForDetection(
  { merchantName: 'Transfer', accountLabel: 'Ally' },
  [
    { id: 'goal-1', name: 'Emergency fund' },
    { id: 'goal-2', name: 'Vacation' },
  ]
)
assert(suggested === 'goal-1', 'defaults to first goal when no name match')

// Source-level guards for the apply path (race + duplicate protection).
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const applySource = readFileSync(
  path.join(__dirname, '../services/savingsTransferDetection.js'),
  'utf8'
)

assert(applySource.includes('FOR UPDATE'), 'apply must lock detection row')
assert(
  applySource.includes("AND status = 'pending'"),
  'apply must claim pending rows only'
)
assert(applySource.includes("error.statusCode = 409"), 'apply must guard possible duplicates')
assert(applySource.includes('force'), 'apply must support force confirm for duplicates')
assert(applySource.includes('BEGIN'), 'apply must run in a transaction')

console.log('  pass: apply path uses transaction + pending claim + duplicate guard')

console.log('All savingsTransferDetection tests passed.')
