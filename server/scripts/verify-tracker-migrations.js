/*
 * Verify and optionally apply tracker migrations 013–017 on production Postgres.
 *
 * Safety: refuses localhost unless ALLOW_LOCAL_DB=1.
 *
 * Check status:
 *   cd server
 *   DATABASE_URL='postgresql://...' node scripts/verify-tracker-migrations.js
 *
 * Apply missing migrations:
 *   DATABASE_URL='postgresql://...' node scripts/verify-tracker-migrations.js --apply
 */

import pg from 'pg'

const { Pool } = pg
const apply = process.argv.includes('--apply')
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required (use Railway Postgres Connect tab URL).')
  process.exit(1)
}

const isLocal =
  /@(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl) ||
  databaseUrl.includes('@localhost:')

if (isLocal && process.env.ALLOW_LOCAL_DB !== '1') {
  console.error(
    'DATABASE_URL looks local. Set ALLOW_LOCAL_DB=1 for local, or use the Railway public URL.'
  )
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

async function hasMonthlyTrackersTable() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'monthly_trackers'`
  )
  return rows.length > 0
}

async function hasMonthlyProgressColumn() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'
       AND column_name = 'monthly_progress_amount'`
  )
  return rows.length > 0
}

async function hasUniqueSpendingIndex() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'monthly_trackers_one_active_spending_per_user_idx'`
  )
  return rows.length > 0
}

async function hasAlertThresholdColumns() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'monthly_trackers'
       AND column_name = 'alert_warning_percent'`
  )
  return rows.length > 0
}

async function hasSavingsTransferDetectionsTable() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'savings_transfer_detections'`
  )
  return rows.length > 0
}

async function runMigrationScript(script) {
  const { spawn } = await import('child_process')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(script))))
  })
}

async function main() {
  console.log('Checking tracker migrations on:', databaseUrl.replace(/:[^:@/]+@/, ':***@'))

  let m013 = await hasMonthlyTrackersTable()
  let m014 = await hasMonthlyProgressColumn()
  let m015 = await hasUniqueSpendingIndex()
  let m016 = await hasAlertThresholdColumns()
  let m017 = await hasSavingsTransferDetectionsTable()

  console.log(`013 monthly_trackers:                    ${m013 ? 'OK' : 'MISSING'}`)
  console.log(`014 monthly_progress_amount:             ${m014 ? 'OK' : 'MISSING'}`)
  console.log(`015 unique active spending index:        ${m015 ? 'OK' : 'MISSING'}`)
  console.log(`016 spending alert thresholds:           ${m016 ? 'OK' : 'MISSING'}`)
  console.log(`017 savings transfer detections:         ${m017 ? 'OK' : 'MISSING'}`)
  console.log('\nTip: prefer `npm run verify:all-migrations` for 006–018 in one pass.')

  if ((!m013 || !m014 || !m015 || !m016 || !m017) && apply) {
    if (!m013) {
      console.log('\nApplying migration 013...')
      await runMigrationScript('scripts/run-013-monthly-trackers-migration.js')
      m013 = await hasMonthlyTrackersTable()
    }

    if (!m014) {
      console.log('\nApplying migration 014...')
      await runMigrationScript('scripts/run-014-saving-monthly-progress-migration.js')
      m014 = await hasMonthlyProgressColumn()
    }

    if (!m015) {
      console.log('\nApplying migration 015...')
      await runMigrationScript('scripts/run-015-unique-spending-tracker-migration.js')
      m015 = await hasUniqueSpendingIndex()
    }

    if (!m016) {
      console.log('\nApplying migration 016...')
      await runMigrationScript('scripts/run-016-spending-alert-thresholds-migration.js')
      m016 = await hasAlertThresholdColumns()
    }

    if (!m017) {
      console.log('\nApplying migration 017...')
      await runMigrationScript('scripts/run-017-savings-transfer-detections-migration.js')
      m017 = await hasSavingsTransferDetectionsTable()
    }
  }

  await pool.end()

  if (m013 && m014 && m015 && m016 && m017) {
    console.log('\nAll tracker migrations verified.')
    process.exit(0)
  }

  if (!apply) {
    console.error('\nRe-run with --apply to run missing migration scripts.')
  } else {
    console.error('\nSome tracker migrations are still missing after --apply.')
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
