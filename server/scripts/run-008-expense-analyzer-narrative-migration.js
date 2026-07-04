/**
 * Idempotent runner for 008_expense_analyzer_narrative_cache.sql
 *
 * Usage: node scripts/run-008-expense-analyzer-narrative-migration.js
 */

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
       AND table_name = 'expense_analyzer_narratives'`
  )

  return result.rows.length > 0
}

try {
  if (await tableExists()) {
    console.log('expense_analyzer_narratives table already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/008_expense_analyzer_narrative_cache.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await tableExists())) {
    console.error('Migration failed: expense_analyzer_narratives was not created.')
    process.exit(1)
  }

  console.log('008 expense analyzer narrative cache migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
