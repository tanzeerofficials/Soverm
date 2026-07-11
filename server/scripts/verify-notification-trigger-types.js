/*
 * Verify notifications.trigger_type CHECK allows spending-cap + ritual types
 * (migrations 018 + 024).
 *
 * Usage:
 *   cd server
 *   DATABASE_URL='postgresql://...' node scripts/verify-notification-trigger-types.js
 *   DATABASE_URL='postgresql://...' node scripts/verify-notification-trigger-types.js --apply
 */

import pg from 'pg'

const { Pool } = pg
const apply = process.argv.includes('--apply')
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required.')
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

const REQUIRED_TYPES = [
  'large_transaction',
  'low_balance',
  'new_recurring_charge',
  'spending_spike',
  'spending_cap_over',
  'spending_cap_warning',
  'weekly_truth_letter',
  'month_condition_ready',
]

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

async function constraintAllowsRequiredTypes() {
  const { rows } = await pool.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE n.nspname = 'public'
       AND t.relname = 'notifications'
       AND c.conname = 'notifications_trigger_type_check'`
  )

  const definition = rows[0]?.definition ?? ''
  return REQUIRED_TYPES.every((type) => definition.includes(`'${type}'`))
}

async function runScript(script) {
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
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed`))
    )
  })
}

async function main() {
  console.log('Checking notification trigger types on:', databaseUrl.replace(/:[^:@/]+@/, ':***@'))

  let ok = await constraintAllowsRequiredTypes()
  console.log(`ritual + cap notification types: ${ok ? 'OK' : 'MISSING'}`)

  if (!ok && apply) {
    console.log('\nApplying migrations 018 then 024...')
    await runScript('scripts/run-018-spending-cap-notification-types-migration.js')
    await runScript('scripts/run-024-ritual-notification-types-migration.js')
    ok = await constraintAllowsRequiredTypes()
  }

  await pool.end()

  if (ok) {
    console.log('\nNotification trigger types verified.')
    process.exit(0)
  }

  if (!apply) {
    console.error('\nRe-run with --apply to run migrations 018/024.')
  } else {
    console.error('\nTrigger types still missing after --apply.')
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
