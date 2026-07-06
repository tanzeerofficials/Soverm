/*
 * Idempotent runner for 007_add_subscription_tier.sql
 *
 * Usage (from server/ with DATABASE_URL set to your target DB):
 *   node scripts/run-007-subscription-tier-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const columnCheck = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'subscription_tier'`
  )

  if (columnCheck.rows.length > 0) {
    console.log('subscription_tier column already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/007_add_subscription_tier.sql'),
    'utf8'
  )
  await db.query(sql)

  const verify = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'subscription_tier'`
  )

  if (verify.rows.length === 0) {
    console.error('Migration failed: subscription_tier was not created.')
    process.exit(1)
  }

  console.log('Migration 007 applied successfully.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
