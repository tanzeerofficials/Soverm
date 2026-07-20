/*
 * Token crypto unit tests (no DB).
 *
 * Usage: PLAID_TOKEN_ENCRYPTION_KEY=<64-hex> node scripts/test-token-crypto.js
 */

import {
  decryptAccessToken,
  encryptAccessToken,
  hashAccessToken,
  isEncryptedAccessToken,
} from '../utils/tokenCrypto.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

if (!process.env.PLAID_TOKEN_ENCRYPTION_KEY) {
  process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32)
}

const plain = 'access-sandbox-unit-test-token'

try {
  console.log('Token crypto tests\n')

  const enc = encryptAccessToken(plain)
  assert(isEncryptedAccessToken(enc), 'encrypt should prefix enc:v1:')
  assert(decryptAccessToken(enc) === plain, 'roundtrip decrypt')
  assert(decryptAccessToken(plain) === plain, 'plaintext passthrough')
  assert(encryptAccessToken(enc) === enc, 'idempotent encrypt')
  assert(hashAccessToken(plain) === hashAccessToken(enc), 'hash matches across forms')
  console.log('  pass: encrypt / decrypt / hash')

  console.log('\n1/1 tests passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
