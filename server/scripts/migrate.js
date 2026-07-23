/*
 * MIGRATION RUNNER (npm run migrate)
 *
 * Single entry point replacing the 25 separate `migrate:0XX` scripts.
 * Tracks applied migrations in a schema_migrations table so re-running is
 * always safe, and pending migrations are never silently skipped.
 *
 * On first run against a database that already has every table/column from
 * the old numbered scripts (a fresh `psql -f schema.sql` load, or an
 * existing dev/prod DB migrated the old way) — every entry in the manifest
 * is detected as already-applied via its `isApplied()` probe and recorded
 * with backfilled = true, WITHOUT executing its SQL file. Only migrations
 * whose end-state is genuinely missing get their .sql file executed.
 *
 * Usage:
 *   npm run migrate              — apply pending migrations
 *   npm run migrate -- --dry-run — report pending/backfill without writing
 */

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { default: db } = await import('../db/index.js')
const { MIGRATIONS } = await import('./migrationManifest.js')

const isDryRun = process.argv.includes('--dry-run')

async function ensureTrackingTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      backfilled BOOLEAN NOT NULL DEFAULT false
    )
  `)
}

async function alreadyTracked(filename) {
  const result = await db.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename]
  )
  return result.rows.length > 0
}

async function recordMigration(filename, backfilled) {
  await db.query(
    `INSERT INTO schema_migrations (filename, backfilled) VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [filename, backfilled]
  )
}

async function applyMigrationFile(filename) {
  const sql = fs.readFileSync(path.join(__dirname, '../db/migrations', filename), 'utf8')
  const client = await db.connect()

  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    await client.query(sql)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function run() {
  await ensureTrackingTable()

  const summary = { alreadyTracked: 0, backfilled: 0, applied: 0 }

  for (const migration of MIGRATIONS) {
    const { filename, isApplied } = migration

    if (await alreadyTracked(filename)) {
      summary.alreadyTracked += 1
      continue
    }

    const applied = await isApplied(db)

    if (applied) {
      console.log(`↷ ${filename} — already applied, backfilling tracking record`)
      if (!isDryRun) {
        await recordMigration(filename, true)
      }
      summary.backfilled += 1
      continue
    }

    console.log(`▶ ${filename} — applying…`)
    if (isDryRun) {
      summary.applied += 1
      continue
    }

    await applyMigrationFile(filename)

    if (!(await isApplied(db))) {
      throw new Error(`Migration ${filename} ran without error, but its verification check still fails.`)
    }

    await recordMigration(filename, false)
    console.log(`✓ ${filename} applied`)
    summary.applied += 1
  }

  const label = isDryRun ? '[dry run] ' : ''
  console.log(
    `\n${label}${summary.alreadyTracked} already tracked, ${summary.backfilled} backfilled, ${summary.applied} applied.`
  )
}

try {
  await run()
  process.exit(0)
} catch (err) {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
}
