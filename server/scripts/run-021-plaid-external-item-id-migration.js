/**
 * Idempotent runner for 021_plaid_external_item_id.sql
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnExists() {
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'plaid_items'
       AND column_name = 'plaid_external_item_id'`
  )
  return result.rows.length > 0
}

try {
  if (await columnExists()) {
    console.log('plaid_external_item_id already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/021_plaid_external_item_id.sql'),
    'utf8'
  )
  await db.query(sql)

  if (!(await columnExists())) {
    console.error('Migration failed: plaid_external_item_id was not created.')
    process.exit(1)
  }

  console.log('021 plaid_external_item_id migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
