/**
 * One-shot backfill: encrypt plaintext Plaid access tokens at rest.
 *
 * What this does: reads plaid_items tokens, encrypts any that are still
 * plaintext, and writes them back. Safe to re-run — already encrypted values
 * are skipped.
 *
 * Requires PLAID_TOKEN_ENCRYPTION_KEY.
 * Prefer running migration 030 first so tokens are not duplicated on accounts.
 *
 * Usage: node scripts/backfill-encrypt-plaid-tokens.js
 */

import 'dotenv/config'
import db from '../db/index.js'
import {
  encryptAccessToken,
  isEncryptedAccessToken,
} from '../utils/tokenCrypto.js'

if (!process.env.PLAID_TOKEN_ENCRYPTION_KEY) {
  console.error('Set PLAID_TOKEN_ENCRYPTION_KEY before running this backfill.')
  process.exit(1)
}

try {
  let itemsUpdated = 0

  const items = await db.query(
    `SELECT id, plaid_access_token FROM plaid_items WHERE plaid_access_token IS NOT NULL`
  )

  for (const row of items.rows) {
    if (isEncryptedAccessToken(row.plaid_access_token)) {
      continue
    }
    const encrypted = encryptAccessToken(row.plaid_access_token)
    await db.query(`UPDATE plaid_items SET plaid_access_token = $1 WHERE id = $2`, [
      encrypted,
      row.id,
    ])
    itemsUpdated += 1
  }

  console.log(`Backfill complete: encrypted ${itemsUpdated} plaid_items`)
  process.exit(0)
} catch (err) {
  console.error('Backfill failed:', err.message)
  process.exit(1)
} finally {
  await db.end()
}
