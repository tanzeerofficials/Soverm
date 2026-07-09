/**
 * Idempotent runner for 014_saving_tracker_monthly_progress.sql
 *
 * Usage: node scripts/run-014-saving-monthly-progress-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'
       AND column_name = 'monthly_progress_amount'`
  )

  return result.rows.length > 0
}

try {
  if (await columnExists()) {
    console.log('monthly_progress_amount column already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/014_saving_tracker_monthly_progress.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await columnExists())) {
    console.error('Migration failed: monthly_progress_amount was not created.')
    process.exit(1)
  }

  console.log('014 saving monthly progress migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
