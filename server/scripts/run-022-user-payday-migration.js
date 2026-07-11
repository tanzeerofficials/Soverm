/**
 * Idempotent runner for 022_user_payday.sql
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function columnExists() {
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'next_payday_on'`
  )
  return result.rows.length > 0
}

try {
  if (await columnExists()) {
    console.log('next_payday_on already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/022_user_payday.sql'),
    'utf8'
  )
  await db.query(sql)

  if (!(await columnExists())) {
    console.error('Migration failed: next_payday_on was not created.')
    process.exit(1)
  }

  console.log('022 user payday migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
