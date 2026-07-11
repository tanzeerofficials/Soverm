/*
 * Verify (and optionally apply) migrations 006–018 against DATABASE_URL.
 *
 * This is the single production readiness check for schema drift.
 * Specialized scripts (verify-tracker-migrations, verify-notification-trigger-types)
 * remain for focused runs; prefer this for deploy checklists.
 *
 * Safety: refuses localhost unless ALLOW_LOCAL_DB=1.
 *
 * Check:
 *   cd server
 *   DATABASE_URL='postgresql://...' node scripts/verify-all-migrations.js
 *
 * Apply missing runners:
 *   DATABASE_URL='postgresql://...' node scripts/verify-all-migrations.js --apply
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

const CAP_TRIGGER_TYPES = [
  'large_transaction',
  'low_balance',
  'new_recurring_charge',
  'spending_spike',
  'spending_cap_over',
  'spending_cap_warning',
]

const RITUAL_TRIGGER_TYPES = ['weekly_truth_letter', 'month_condition_ready']

async function tableExists(tableName) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  return rows.length > 0
}

async function columnExists(tableName, columnName) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName]
  )
  return rows.length > 0
}

async function indexExists(indexName) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = $1`,
    [indexName]
  )
  return rows.length > 0
}

async function notificationTriggerTypesOk(requiredTypes) {
  if (!(await tableExists('notifications'))) {
    return false
  }

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
  return requiredTypes.every((type) => definition.includes(`'${type}'`))
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

const CHECKS = [
  {
    id: '006',
    label: '006 chat_messages',
    check: () => tableExists('chat_messages'),
    script: 'scripts/run-006-chat-migration.js',
  },
  {
    id: '007',
    label: '007 subscription_tier',
    check: () => columnExists('users', 'subscription_tier'),
    script: 'scripts/run-007-subscription-tier-migration.js',
  },
  {
    id: '008',
    label: '008 expense_analyzer_narratives',
    check: () => tableExists('expense_analyzer_narratives'),
    script: 'scripts/run-008-expense-analyzer-narrative-migration.js',
  },
  {
    id: '009',
    label: '009 notifications table',
    check: () => tableExists('notifications'),
    script: 'scripts/run-009-notifications-migration.js',
  },
  {
    id: '010',
    label: '010 proactive_notifications_enabled',
    check: () => columnExists('users', 'proactive_notifications_enabled'),
    script: 'scripts/run-010-notification-preferences-migration.js',
  },
  {
    id: '011',
    label: '011 monthly_budget',
    check: () => columnExists('users', 'monthly_budget'),
    script: 'scripts/run-011-monthly-budget-migration.js',
  },
  {
    id: '013',
    label: '013 monthly_trackers',
    check: () => tableExists('monthly_trackers'),
    script: 'scripts/run-013-monthly-trackers-migration.js',
  },
  {
    id: '014',
    label: '014 monthly_progress_amount',
    check: () => columnExists('monthly_trackers', 'monthly_progress_amount'),
    script: 'scripts/run-014-saving-monthly-progress-migration.js',
  },
  {
    id: '015',
    label: '015 unique active spending index',
    check: () => indexExists('monthly_trackers_one_active_spending_per_user_idx'),
    script: 'scripts/run-015-unique-spending-tracker-migration.js',
  },
  {
    id: '016',
    label: '016 spending alert thresholds',
    check: () => columnExists('monthly_trackers', 'alert_warning_percent'),
    script: 'scripts/run-016-spending-alert-thresholds-migration.js',
  },
  {
    id: '017',
    label: '017 savings_transfer_detections',
    check: () => tableExists('savings_transfer_detections'),
    script: 'scripts/run-017-savings-transfer-detections-migration.js',
  },
  {
    id: '018',
    label: '018 spending_cap notification types',
    check: () => notificationTriggerTypesOk(CAP_TRIGGER_TYPES),
    script: 'scripts/run-018-spending-cap-notification-types-migration.js',
  },
  {
    id: '019',
    label: '019 stripe billing columns',
    check: async () =>
      (await columnExists('users', 'stripe_customer_id')) &&
      (await columnExists('users', 'stripe_subscription_id')),
    script: 'scripts/run-019-stripe-billing-columns-migration.js',
  },
  {
    id: '020',
    label: '020 category_soft_limits',
    check: () => tableExists('category_soft_limits'),
    script: 'scripts/run-020-category-soft-limits-migration.js',
  },
  {
    id: '021',
    label: '021 plaid_external_item_id',
    check: () => columnExists('plaid_items', 'plaid_external_item_id'),
    script: 'scripts/run-021-plaid-external-item-id-migration.js',
  },
  {
    id: '022',
    label: '022 user payday columns',
    check: async () =>
      (await columnExists('users', 'next_payday_on')) &&
      (await columnExists('users', 'pay_cadence')),
    script: 'scripts/run-022-user-payday-migration.js',
  },
  {
    id: '023',
    label: '023 action lifecycle columns',
    check: () => columnExists('actions', 'status'),
    script: 'scripts/run-023-action-lifecycle-migration.js',
  },
  {
    id: '024',
    label: '024 ritual notification types',
    check: () => notificationTriggerTypesOk([...CAP_TRIGGER_TYPES, ...RITUAL_TRIGGER_TYPES]),
    script: 'scripts/run-024-ritual-notification-types-migration.js',
  },
]

async function main() {
  console.log('Checking migrations on:', databaseUrl.replace(/:[^:@/]+@/, ':***@'))
  console.log('(012 savings_goals is legacy — superseded by 013 monthly_trackers)\n')

  const results = {}

  for (const item of CHECKS) {
    results[item.id] = await item.check()
    console.log(`${item.label.padEnd(42)} ${results[item.id] ? 'OK' : 'MISSING'}`)
  }

  const missing = CHECKS.filter((item) => !results[item.id])

  if (missing.length > 0 && apply) {
    for (const item of missing) {
      console.log(`\nApplying migration ${item.id}...`)
      await runMigrationScript(item.script)
      results[item.id] = await item.check()
    }
  }

  await pool.end()

  const stillMissing = CHECKS.filter((item) => !results[item.id])

  if (stillMissing.length === 0) {
    console.log('\nAll migrations 006–024 verified.')
    process.exit(0)
  }

  if (!apply) {
    console.error('\nRe-run with --apply to run missing migration scripts.')
  } else {
    console.error('\nSome migrations are still missing after --apply:')
    for (const item of stillMissing) {
      console.error(`  - ${item.label}`)
    }
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
