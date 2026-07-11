/**
 * Idempotent runner for 018_spending_cap_notification_types.sql
 *
 * Usage: node scripts/run-018-spending-cap-notification-types-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REQUIRED_TYPES = [
  'large_transaction',
  'low_balance',
  'new_recurring_charge',
  'spending_spike',
  'spending_cap_over',
  'spending_cap_warning',
]

async function tableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'notifications'`
  )
  return result.rows.length > 0
}

async function constraintDefinition() {
  const result = await db.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND t.relname = 'notifications'
       AND c.conname = 'notifications_trigger_type_check'`
  )
  return result.rows[0]?.definition ?? null
}

function constraintAllowsCapTypes(definition) {
  if (!definition) {
    return false
  }

  return REQUIRED_TYPES.every((type) => definition.includes(`'${type}'`))
}

try {
  if (!(await tableExists())) {
    console.error(
      'Migration failed: notifications table is missing — run migration 009 first.'
    )
    process.exit(1)
  }

  const before = await constraintDefinition()
  if (constraintAllowsCapTypes(before)) {
    console.log(
      'notifications_trigger_type_check already allows spending_cap_* types — nothing to do.'
    )
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/018_spending_cap_notification_types.sql'),
    'utf8'
  )

  await db.query(sql)

  const after = await constraintDefinition()
  if (!constraintAllowsCapTypes(after)) {
    console.error(
      'Migration failed: spending_cap_over / spending_cap_warning are still not allowed.'
    )
    process.exit(1)
  }

  console.log('018 spending cap notification types migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
