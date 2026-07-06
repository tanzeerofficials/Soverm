/**
 * Idempotent runner for 010_add_notification_preferences.sql
 *
 * Usage: node scripts/run-010-notification-preferences-migration.js
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
       AND table_name = 'users'
       AND column_name = 'proactive_notifications_enabled'`
  )

  return result.rows.length > 0
}

try {
  if (await columnExists()) {
    console.log('proactive_notifications_enabled column already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/010_add_notification_preferences.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await columnExists())) {
    console.error('Migration failed: proactive_notifications_enabled was not created.')
    process.exit(1)
  }

  console.log('010 notification preferences migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
