/*
 * Verifies bank-descriptor merchant normalization for recurring detection.
 *
 * Usage: node scripts/test-merchant-normalize.js
 */

import 'dotenv/config'
import {
  formatMerchantDisplayLabel,
  formatSubscriptionMerchantLabel,
  normalizeMerchantName,
  stripBankDescriptor,
} from '../utils/merchantNormalize.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

let passed = 0

try {
  console.log('Merchant normalization tests\n')

  assert(normalizeMerchantName('SPOTIFY USA') === 'spotify', 'Spotify variant')
  assert(normalizeMerchantName('SPOTIFY*PREMIUM') === 'spotify', 'Spotify premium variant')

  const replitApril =
    'PURCHASE 0422 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX6827 RECURRING'
  const replitMay =
    'PURCHASE 0522 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5660 RECURRING'
  const replitJune =
    'PURCHASE 0622 REPLIT, INC. REPLIT.COM CA XXXXX3461XXXXXXXXXX5699 RECURRING'

  assert(
    normalizeMerchantName(replitApril) === 'replit inc replit com',
    'Replit April descriptor groups to stable merchant key'
  )
  assert(
    normalizeMerchantName(replitMay) === normalizeMerchantName(replitApril),
    'Replit May descriptor matches April key'
  )
  assert(
    normalizeMerchantName(replitJune) === normalizeMerchantName(replitApril),
    'Replit June descriptor matches April key'
  )
  assert(
    stripBankDescriptor(replitApril).includes('replit') &&
      stripBankDescriptor(replitApril).includes('inc'),
    'Strip keeps merchant tokens like REPLIT and INC'
  )
  assert(!stripBankDescriptor(replitApril).includes('0422'), 'Strip removes MMDD date code')
  assert(!stripBankDescriptor(replitApril).includes('recurring'), 'Strip removes RECURRING')
  console.log('  pass: Replit bank descriptors normalize to one merchant key')
  passed++

  const claudeSub =
    'CHECKCARD 0504 CLAUDE.AI SUBSCRIPTION ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1182 RECURRING'
  const claudeSubAlt =
    'PURCHASE 0604 ANTHROPIC* CLAUDE SUB ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX7951 RECURRING'
  const anthropicApi =
    'PURCHASE 0617 ANTHROPIC ANTHROPIC.COMCA XXXXX3461XXXXXXXXXX1768'

  assert(
    normalizeMerchantName(claudeSub) === 'claude ai subscription anthropic',
    'Claude.ai subscription descriptor key'
  )
  assert(
    normalizeMerchantName(claudeSubAlt) === 'claude ai subscription anthropic',
    'Alternate Claude subscription descriptor matches same key'
  )
  assert(
    normalizeMerchantName(anthropicApi) === 'anthropic anthropic comca',
    'Separate Anthropic API/product descriptor stays distinct'
  )
  assert(
    normalizeMerchantName(claudeSub) !== normalizeMerchantName(anthropicApi),
    'Claude subscription and Anthropic API are not merged'
  )
  assert(
    formatMerchantDisplayLabel('claude ai subscription anthropic', claudeSub) ===
      'Claude.ai Subscription',
    'Claude subscription display label'
  )
  assert(
    formatMerchantDisplayLabel('anthropic anthropic comca', anthropicApi) === 'Anthropic',
    'Anthropic API display label'
  )
  console.log('  pass: Anthropic products stay separate while Claude subscription variants merge')
  passed++

  assert(normalizeMerchantName('SparkFun') === 'sparkfun', 'Simple merchants unchanged')
  assert(formatSubscriptionMerchantLabel('replit') === 'Replit', 'Display label formatting')
  console.log('  pass: simple merchants and labels')
  passed++

  console.log(`\n${passed}/${passed} tests passed`)
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
