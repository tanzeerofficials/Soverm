/**
 * Idempotent runner for 024_ritual_notification_types.sql
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REQUIRED = ['weekly_truth_letter', 'month_condition_ready']

async function constraintAllowsRitualTypes() {
  const result = await db.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND t.relname = 'notifications'
       AND c.conname = 'notifications_trigger_type_check'`
  )
  const definition = result.rows[0]?.definition ?? ''
  return REQUIRED.every((type) => definition.includes(`'${type}'`))
}

try {
  if (await constraintAllowsRitualTypes()) {
    console.log('024 ritual notification types already applied — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/024_ritual_notification_types.sql'),
    'utf8'
  )
  await db.query(sql)

  if (!(await constraintAllowsRitualTypes())) {
    console.error('Migration failed: ritual trigger types not present on constraint.')
    process.exit(1)
  }

  console.log('024 ritual notification types migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
