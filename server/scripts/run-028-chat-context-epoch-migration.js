/**
 * Idempotent runner for 028_chat_context_epoch.sql
 *
 * Usage: node scripts/run-028-chat-context-epoch-migration.js
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
  if (await columnExists('chat_context_epoch')) {
    console.log('users.chat_context_epoch already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/028_chat_context_epoch.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await columnExists('chat_context_epoch'))) {
    console.error('Migration failed: chat_context_epoch was not created.')
    process.exit(1)
  }

  console.log('Migration 028 applied: users.chat_context_epoch')
  process.exit(0)
} catch (err) {
  console.error('Migration 028 failed:', err.message)
  process.exit(1)
} finally {
  await db.end()
}
