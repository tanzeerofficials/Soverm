/**
 * Idempotent runner for 012_create_savings_goals.sql
 *
 * Usage: node scripts/run-012-savings-goals-migration.js
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
       AND table_name = 'savings_goals'`
  )

  return result.rows.length > 0
}

try {
  if (await tableExists()) {
    console.log('savings_goals table already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/012_create_savings_goals.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await tableExists())) {
    console.error('Migration failed: savings_goals was not created.')
    process.exit(1)
  }

  console.log('012 savings goals migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
