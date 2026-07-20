/**
 * Idempotent runner for 030_drop_accounts_plaid_access_token.sql
 *
 * Usage: node scripts/run-030-drop-accounts-plaid-access-token-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnExists(tableName, columnName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName]
  )
  return result.rows.length > 0
}

try {
  if (!(await columnExists('accounts', 'plaid_access_token'))) {
    console.log('accounts.plaid_access_token already dropped — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/030_drop_accounts_plaid_access_token.sql'),
    'utf8'
  )

  await db.query(sql)

  if (await columnExists('accounts', 'plaid_access_token')) {
    console.error('Migration failed: accounts.plaid_access_token still exists.')
    process.exit(1)
  }

  console.log('Migration 030 applied: dropped accounts.plaid_access_token')
  process.exit(0)
} catch (err) {
  console.error('Migration 030 failed:', err.message)
  process.exit(1)
} finally {
  await db.end()
}
