/*
 * PLAID ACCESS TOKEN CRYPTO
 *
 * What this does: envelope-encrypts Plaid access tokens before they hit Postgres,
 * and decrypts them when we need to call Plaid APIs.
 *
 * Why: a DB dump or backup should not expose live bank Item tokens in plaintext.
 *
 * Format: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64> (AES-256-GCM).
 * Plaintext values (no prefix) still decrypt as a pass-through so existing rows
 * keep working until a backfill encrypts them.
 *
 * Key: PLAID_TOKEN_ENCRYPTION_KEY — 32-byte secret as 64 hex chars or base64.
 * When unset, tokens stay plaintext (local/dev only — boot logs a warning).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

let cachedKey = undefined
let missingKeyWarned = false

function parseKey(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return null
  }

  const trimmed = raw.trim()

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  try {
    const fromB64 = Buffer.from(trimmed, 'base64')
    if (fromB64.length === 32) {
      return fromB64
    }
  } catch {
    // fall through
  }

  // Derive a stable 32-byte key from a passphrase-length secret.
  return createHash('sha256').update(trimmed).digest()
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.REQUIRE_PLAID_TOKEN_ENCRYPTION === '1'
  )
}

function getEncryptionKey() {
  if (cachedKey !== undefined) {
    return cachedKey
  }

  cachedKey = parseKey(process.env.PLAID_TOKEN_ENCRYPTION_KEY)

  if (!cachedKey && !missingKeyWarned) {
    missingKeyWarned = true
    if (isProductionRuntime()) {
      console.error(
        '[token-crypto] PLAID_TOKEN_ENCRYPTION_KEY is required in production — refusing plaintext token storage'
      )
    } else {
      console.warn(
        '[token-crypto] PLAID_TOKEN_ENCRYPTION_KEY is unset — Plaid access tokens will be stored in plaintext'
      )
    }
  }

  return cachedKey
}

export function isEncryptedAccessToken(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptAccessToken(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext
  }

  if (isEncryptedAccessToken(plaintext)) {
    return plaintext
  }

  const key = getEncryptionKey()
  if (!key) {
    if (isProductionRuntime()) {
      throw new Error(
        'PLAID_TOKEN_ENCRYPTION_KEY is required before storing Plaid access tokens'
      )
    }
    return plaintext
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptAccessToken(stored) {
  if (!stored || typeof stored !== 'string') {
    return stored
  }

  if (!isEncryptedAccessToken(stored)) {
    return stored
  }

  const key = getEncryptionKey()
  if (!key) {
    throw new Error(
      'Encrypted Plaid token found but PLAID_TOKEN_ENCRYPTION_KEY is not configured'
    )
  }

  const payload = stored.slice(PREFIX.length)
  const [ivB64, tagB64, dataB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted Plaid access token')
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/** Hash for equality checks when ciphertext differs per encryption. */
export function hashAccessToken(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return null
  }
  const clear = isEncryptedAccessToken(plaintext)
    ? decryptAccessToken(plaintext)
    : plaintext
  return createHash('sha256').update(clear).digest('hex')
}
