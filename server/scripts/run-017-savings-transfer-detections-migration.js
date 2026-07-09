/**
 * Idempotent runner for 017_savings_transfer_detections.sql
 *
 * Usage: node scripts/run-017-savings-transfer-detections-migration.js
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
       AND table_name = 'savings_transfer_detections'`
  )

  return result.rows.length > 0
}

try {
  if (await tableExists()) {
    console.log('savings_transfer_detections already exists — nothing to do.')
    process.exit(0)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/migrations/017_savings_transfer_detections.sql'),
    'utf8'
  )

  await db.query(sql)

  if (!(await tableExists())) {
    console.error('Migration failed: savings_transfer_detections was not created.')
    process.exit(1)
  }

  console.log('017 savings transfer detections migration applied.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
}
