/**
 * Idempotent runner for 015_unique_active_spending_tracker.sql
 *
 * Usage: node scripts/run-015-unique-spending-tracker-migration.js
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_NAME = 'monthly_trackers_one_active_spending_per_user_idx'

async function indexExists() {
  const result = await db.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = $1`,
    [INDEX_NAME]
  )

  return result.rows.length > 0
}

try {
  if (await indexExists()) {
    console.log(`${INDEX_NAME} already exists — nothing to do.`)
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/015_unique_active_spending_tracker.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await indexExists())) {
    console.error(`Migration failed: ${INDEX_NAME} was not created.`)
    process.exit(1)
  }

  console.log('015 unique active spending tracker migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
