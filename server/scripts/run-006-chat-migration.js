/*
 * Idempotent runner for 006_create_chat_messages.sql
 *
 * Usage (from server/ with DATABASE_URL set to your target DB):
 *   node scripts/run-006-chat-migration.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const existing = await db.query(
    "SELECT to_regclass('public.chat_messages') AS tbl"
  )

  if (existing.rows[0].tbl) {
    console.log('chat_messages table already exists — nothing to do.')
    process.exit(0)
  }

  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/006_create_chat_messages.sql'),
    'utf8'
  )
  await db.query(sql)

  const verify = await db.query(
    "SELECT to_regclass('public.chat_messages') AS tbl"
  )

  if (!verify.rows[0].tbl) {
    console.error('Migration failed: chat_messages was not created.')
    process.exit(1)
  }

  console.log('Migration 006 applied successfully.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
