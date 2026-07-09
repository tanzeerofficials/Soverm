/**
 * Idempotent runner for 016_spending_alert_thresholds.sql
 *
 * Usage: node scripts/run-016-spending-alert-thresholds-migration.js
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
       AND table_name = 'monthly_trackers'
       AND column_name = $1`,
    [columnName]
  )

  return result.rows.length > 0
}

try {
  const hasPercent = await columnExists('alert_warning_percent')
  const hasDollars = await columnExists('alert_remaining_dollars')

  if (hasPercent && hasDollars) {
    console.log('alert_warning_percent and alert_remaining_dollars already exist — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/016_spending_alert_thresholds.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await columnExists('alert_warning_percent')) || !(await columnExists('alert_remaining_dollars'))) {
    console.error('Migration failed: alert threshold columns were not created.')
    process.exit(1)
  }

  console.log('016 spending alert thresholds migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
