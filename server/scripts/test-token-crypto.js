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
  resetTokenCryptoForTests,
} from '../utils/tokenCrypto.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32)
resetTokenCryptoForTests()

const plain = 'access-sandbox-unit-test-token'

try {
  console.log('Token crypto tests\n')

  const enc = encryptAccessToken(plain)
  assert(isEncryptedAccessToken(enc), 'encrypt should prefix enc:v1:')
  assert(decryptAccessToken(enc) === plain, 'roundtrip decrypt')
  assert(decryptAccessToken(plain) === plain, 'plaintext passthrough')
  assert(encryptAccessToken(enc) === enc, 'idempotent encrypt')
  assert(hashAccessToken(plain) === hashAccessToken(enc), 'hash matches across forms')

  const parts = enc.slice('enc:v1:'.length).split(':')
  assert(parts.length === 3, 'stored format has iv:tag:ciphertext')
  assert(Buffer.from(parts[0], 'base64').length === 12, 'iv is 12 bytes')
  assert(Buffer.from(parts[1], 'base64').length === 16, 'auth tag is 16 bytes')
  console.log('  pass: encrypt / decrypt / hash / nonce+tag layout')

  resetTokenCryptoForTests()
  process.env.PLAID_TOKEN_ENCRYPTION_KEY = 'short-passphrase'
  let rejected = false
  try {
    encryptAccessToken(plain)
  } catch (err) {
    rejected = /64 hex|32-byte base64/i.test(err.message)
  }
  assert(rejected, 'weak passphrase keys must be rejected')
  console.log('  pass: rejects weak passphrase key derivation')

  console.log('\n2/2 tests passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}
