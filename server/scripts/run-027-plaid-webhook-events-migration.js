/**
 * Idempotent runner for 027_plaid_webhook_events.sql
 *
 * Usage: node scripts/run-027-plaid-webhook-events-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function tableExists(tableName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  )
  return result.rows.length > 0
}

try {
  if (await tableExists('plaid_webhook_events')) {
    console.log('plaid_webhook_events already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/027_plaid_webhook_events.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await tableExists('plaid_webhook_events'))) {
    console.error('Migration failed: plaid_webhook_events was not created.')
    process.exit(1)
  }

  console.log('Migration 027 applied: plaid_webhook_events')
  process.exit(0)
} catch (err) {
  console.error('Migration 027 failed:', err.message)
  process.exit(1)
} finally {
  await db.end()
}
