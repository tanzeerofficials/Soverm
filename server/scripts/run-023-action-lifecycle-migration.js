/**
 * Idempotent runner for 023_action_lifecycle.sql
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
       AND table_name = 'actions'
       AND column_name = 'status'`
  )
  return result.rows.length > 0
}

try {
  if (await columnExists()) {
    console.log('actions.status already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/023_action_lifecycle.sql'),
    'utf8'
  )
  await db.query(sql)

  if (!(await columnExists())) {
    console.error('Migration failed: actions.status was not created.')
    process.exit(1)
  }

  console.log('023 action lifecycle migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
