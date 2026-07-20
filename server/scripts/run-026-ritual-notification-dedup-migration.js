/**
 * Idempotent runner for 026_ritual_notification_dedup_unique.sql
 *
 * Usage: node scripts/run-026-ritual-notification-dedup-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function indexExists(indexName) {
  const result = await db.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = $1`,
    [indexName]
  )
  return result.rows.length > 0
}

try {
  if (await indexExists('notifications_user_trigger_dedup_uidx')) {
    console.log('Ritual notification dedup unique index already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/026_ritual_notification_dedup_unique.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await indexExists('notifications_user_trigger_dedup_uidx'))) {
    console.error('Migration failed: unique dedup index was not created.')
    process.exit(1)
  }

  console.log('Migration 026 applied: notifications_user_trigger_dedup_uidx')
  process.exit(0)
} catch (err) {
  console.error('Migration 026 failed:', err.message)
  process.exit(1)
} finally {
  await db.end()
}
