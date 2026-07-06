/**
 * Idempotent runner for 009_create_notifications.sql
 *
 * Usage: node scripts/run-009-notifications-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function tableExists() {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'notifications'`
  )

  return result.rows.length > 0
}

try {
  if (await tableExists()) {
    console.log('notifications table already exists — nothing to do.')
    process.exit(0)
  }

  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/009_create_notifications.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await tableExists())) {
    console.error('Migration failed: notifications was not created.')
    process.exit(1)
  }

  console.log('009 notifications migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
