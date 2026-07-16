/**
 * Idempotent runner for 025_stripe_cancel_at_period_end.sql
 *
 * Usage: node scripts/run-025-stripe-cancel-at-period-end-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnExists(columnName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = $1`,
    [columnName]
  )
  return result.rows.length > 0
}

try {
  const hasCancel = await columnExists('stripe_cancel_at_period_end')
  const hasPeriodEnd = await columnExists('stripe_current_period_end')

  if (hasCancel && hasPeriodEnd) {
    console.log('Stripe cancel-at-period-end columns already exist — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/025_stripe_cancel_at_period_end.sql'),
    'utf8'
  )

  await db.query(sql)

  if (
    !(await columnExists('stripe_cancel_at_period_end')) ||
    !(await columnExists('stripe_current_period_end'))
  ) {
    console.error('Migration failed: cancel-at-period-end columns were not created.')
    process.exit(1)
  }

  console.log('025 Stripe cancel-at-period-end migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
