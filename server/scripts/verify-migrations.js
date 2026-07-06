/*
 * Verify migrations 006 (chat_messages) and 007 (subscription_tier)
 * against the database pointed to by DATABASE_URL.
 *
 * Safety: refuses localhost unless ALLOW_LOCAL_DB=1.
 *
 * Usage (production — paste URL from Railway Connect tab):
 *   cd server
 *   DATABASE_URL='postgresql://...' node scripts/verify-migrations.js
 *
 * Apply missing migrations (production only):
 *   DATABASE_URL='postgresql://...' node scripts/verify-migrations.js --apply
 */

import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const apply = process.argv.includes('--apply')
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required (use Railway Connect tab URL).')
  process.exit(1)
}

const isLocal =
  /@(localhost|127\.0\.0\.1)(:|\/)/.test(databaseUrl) ||
  databaseUrl.includes('@localhost:')

if (isLocal && process.env.ALLOW_LOCAL_DB !== '1') {
  console.error(
    'DATABASE_URL looks local. Set ALLOW_LOCAL_DB=1 to verify local, or use production Railway URL.'
  )
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

async function checkChatMessages() {
  const { rows } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'chat_messages'`
  )
  return rows.length > 0
}

async function checkSubscriptionTier() {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'subscription_tier'`
  )
  return rows.length > 0
}

async function main() {
  console.log('Checking migrations on:', databaseUrl.replace(/:[^:@/]+@/, ':***@'))

  let chatOk = await checkChatMessages()
  let tierOk = await checkSubscriptionTier()

  console.log(`006 chat_messages:        ${chatOk ? 'OK' : 'MISSING'}`)
  console.log(`007 subscription_tier:    ${tierOk ? 'OK' : 'MISSING'}`)

  if ((!chatOk || !tierOk) && apply) {
    const { spawn } = await import('child_process')
    const path = await import('path')
    const { fileURLToPath } = await import('url')
    const serverDir = path.dirname(fileURLToPath(new URL('..', import.meta.url)))

    const run = (script) =>
      new Promise((resolve, reject) => {
        const child = spawn('node', [script], {
          cwd: serverDir,
          env: { ...process.env, DATABASE_URL: databaseUrl },
          stdio: 'inherit',
        })
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(script))))
      })

    if (!chatOk) {
      console.log('\nApplying migration 006...')
      await run('scripts/run-006-chat-migration.js')
      chatOk = await checkChatMessages()
    }
    if (!tierOk) {
      console.log('\nApplying migration 007...')
      await run('scripts/run-007-subscription-tier-migration.js')
      tierOk = await checkSubscriptionTier()
    }
  }

  await pool.end()

  if (chatOk && tierOk) {
    console.log('\nAll migrations verified.')
    process.exit(0)
  }

  if (!apply) {
    console.error('\nRe-run with --apply to run missing migration scripts.')
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
