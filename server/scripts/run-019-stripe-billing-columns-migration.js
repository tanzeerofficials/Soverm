/**
 * Idempotent runner for 019_stripe_billing_columns.sql
 *
 * Usage: node scripts/run-019-stripe-billing-columns-migration.js
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
  const hasCustomer = await columnExists('stripe_customer_id')
  const hasSubscription = await columnExists('stripe_subscription_id')

  if (hasCustomer && hasSubscription) {
    console.log('Stripe billing columns already exist — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/019_stripe_billing_columns.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await columnExists('stripe_customer_id')) || !(await columnExists('stripe_subscription_id'))) {
    console.error('Migration failed: Stripe columns were not created.')
    process.exit(1)
  }

  console.log('019 Stripe billing columns migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
