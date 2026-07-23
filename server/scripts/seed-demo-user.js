/*
 * DEMO USER SEED (npm run seed:demo)
 *
 * Creates/resets the read-only demo account served by middleware/demoMode.js.
 * Idempotent: wipes all demo_user rows and re-inserts a curated ~90-day
 * dataset, with dates computed relative to today so the demo never goes stale.
 *
 * The dataset is designed so every headline feature fires:
 * - Netflix 15.49 → 16.99 with two identical old-price charges under different
 *   bank descriptors → CONFIRMED recurring + Bill Defense price-increase card
 * - Spotify / Planet Fitness → keyword subscriptions, high confidence
 * - City Power & Light with ±3% amounts → variable-amount tolerance detection
 *   (lands in Review — shows that bucket too)
 * - McDonald's / Starbucks repeats → must NOT be detected (coincidental denylist)
 * - Dining up strongly vs prior 30 days → top mover
 * - Biweekly ACME payroll → payday inference + what's-left-until-payday
 * - Best Buy purchase + refund → same-merchant refund netting
 * - Rent, credit-card autopay, savings transfers → excluded from spend totals,
 *   visible in the cash-flow ledger
 *
 * The Plaid item row is FAKE ('demo:' token). jobs/syncAllUsers.js skips
 * DEMO_USER_ID, and proactive_notifications_enabled=false keeps the demo user
 * out of the digest email jobs.
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { default: db } = await import('../db/index.js')
const { DEMO_USER_ID } = await import('../middleware/demoMode.js')
const { formatIsoDateInAppTz } = await import('../utils/calendarMonth.js')

const DEMO_EMAIL = 'demo-user@soverm.app'
const DEMO_ACCESS_TOKEN = 'demo:not-a-real-token'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatIsoDateInAppTz(d)
}

function daysAhead(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return formatIsoDateInAppTz(d)
}

/**
 * Deletes every row belonging to the demo user from any table with a user_id
 * column. Multi-pass so FK ordering (actions→insights, transactions→accounts…)
 * resolves without hardcoding the full table list.
 */
async function wipeDemoRows(client) {
  const tablesResult = await client.query(
    `SELECT DISTINCT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'user_id'`
  )
  let remaining = tablesResult.rows
    .map((row) => row.table_name)
    .filter((name) => name !== 'users')

  for (let pass = 0; pass < 5 && remaining.length > 0; pass++) {
    const failed = []
    for (const table of remaining) {
      // SAVEPOINT so an FK violation doesn't abort the whole transaction.
      await client.query('SAVEPOINT wipe_table')
      try {
        await client.query(`DELETE FROM ${JSON.stringify(table).slice(1, -1)} WHERE user_id = $1`, [
          DEMO_USER_ID,
        ])
        await client.query('RELEASE SAVEPOINT wipe_table')
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT wipe_table')
        if (err.code === '23503') {
          failed.push(table) // FK still referenced — retry next pass
        } else {
          throw err
        }
      }
    }
    remaining = failed
  }

  if (remaining.length > 0) {
    throw new Error(`Could not clear demo rows from: ${remaining.join(', ')}`)
  }
}

function buildTransactions({ checkingId, savingsId, creditId }) {
  const rows = []
  let seq = 0

  function add(accountId, name, amount, dateIso, category) {
    seq += 1
    rows.push({
      accountId,
      name,
      amount,
      date: dateIso,
      category,
      plaidTransactionId: `demo-txn-${String(seq).padStart(3, '0')}`,
    })
  }

  // --- Income: biweekly payroll (negative = inflow) -------------------------
  for (const d of [3, 17, 31, 45, 59, 73, 87]) {
    add(checkingId, 'ACME CORP PAYROLL DIRECT DEP', -2150.0, daysAgo(d), 'Payroll')
  }

  // --- Subscriptions (credit card) ------------------------------------------
  // Netflix: two identical old-price charges whose RAW descriptors differ but
  // normalize to the same merchant key ('CA' is a stripped state token) —
  // that's the 2-hit keyword high-confidence path. The price hike is latest.
  add(creditId, 'NETFLIX.COM', 15.49, daysAgo(82), 'Service')
  add(creditId, 'NETFLIX.COM CA', 15.49, daysAgo(52), 'Service')
  add(creditId, 'NETFLIX.COM', 16.99, daysAgo(22), 'Service')

  add(creditId, 'SPOTIFY USA', 11.99, daysAgo(78), 'Service')
  add(creditId, 'SPOTIFY USA', 11.99, daysAgo(48), 'Service')
  add(creditId, 'SPOTIFY USA', 11.99, daysAgo(18), 'Service')

  add(creditId, 'PLANET FITNESS CLUB FEES', 24.99, daysAgo(70), 'Gyms and Fitness')
  add(creditId, 'PLANET FITNESS CLUB FEES', 24.99, daysAgo(40), 'Gyms and Fitness')
  add(creditId, 'PLANET FITNESS CLUB FEES', 24.99, daysAgo(10), 'Gyms and Fitness')

  // Variable-amount utility (checking): within 5% tolerance, non-keyword,
  // subscription-likely category → detected via the tolerance pass → Review.
  add(checkingId, 'CITY POWER & LIGHT', 84.23, daysAgo(75), 'Service')
  add(checkingId, 'CITY POWER & LIGHT', 87.6, daysAgo(45), 'Service')
  add(checkingId, 'CITY POWER & LIGHT', 82.95, daysAgo(15), 'Service')

  // --- Rent: identical monthly, no keyword → identical-amount fallback ------
  add(checkingId, 'CITYVIEW APARTMENTS RENT', 1450.0, daysAgo(63), 'Rent')
  add(checkingId, 'CITYVIEW APARTMENTS RENT', 1450.0, daysAgo(33), 'Rent')
  add(checkingId, 'CITYVIEW APARTMENTS RENT', 1450.0, daysAgo(3), 'Rent')

  // --- Coincidental repeats: must stay OUT of recurring ---------------------
  for (const [d, amt] of [[65, 9.87], [51, 11.23], [37, 9.87], [23, 12.4], [9, 8.75]]) {
    add(creditId, "MCDONALD'S #4521", amt, daysAgo(d), 'Food and Drink')
  }
  for (const [d, amt] of [[72, 6.45], [58, 6.45], [39, 7.1], [26, 6.45], [12, 6.45], [4, 7.1]]) {
    add(creditId, 'STARBUCKS STORE 08721', amt, daysAgo(d), 'Food and Drink')
  }

  // --- Dining: strong top mover (current 30d well above prior) --------------
  add(creditId, 'THE LOCAL BISTRO', 45.8, daysAgo(48), 'Food and Drink')
  add(creditId, 'SUSHI GARDEN', 38.2, daysAgo(41), 'Food and Drink')
  add(creditId, 'THE LOCAL BISTRO', 62.35, daysAgo(19), 'Food and Drink')
  add(creditId, 'SUSHI GARDEN', 71.9, daysAgo(12), 'Food and Drink')
  add(creditId, 'TACOS EL REY', 28.4, daysAgo(8), 'Food and Drink')
  add(creditId, 'THE LOCAL BISTRO', 54.1, daysAgo(5), 'Food and Drink')

  // --- Groceries: steady weekly-ish, varied amounts (never "recurring") -----
  const groceryAmounts = [87.45, 92.1, 84.6, 105.3, 78.25, 96.8, 88.15, 91.4, 83.7, 99.55, 86.2, 94.75]
  groceryAmounts.forEach((amt, i) => {
    add(checkingId, 'WHOLE FOODS MARKET', amt, daysAgo(86 - i * 7), 'Groceries')
  })

  // --- Gas ------------------------------------------------------------------
  const gasStops = [[84, 42.1], [73, 38.6], [62, 45.2], [50, 40.75], [39, 43.3], [28, 39.9], [16, 44.6], [6, 41.25]]
  for (const [d, amt] of gasStops) {
    add(checkingId, 'SHELL OIL 57442199', amt, daysAgo(d), 'Gas Stations')
  }

  // --- Shopping incl. refund pair (same merchant → netted) ------------------
  add(creditId, 'BEST BUY #1024', 129.99, daysAgo(14), 'Shops')
  add(creditId, 'BEST BUY #1024', -129.99, daysAgo(11), 'Shops')
  add(creditId, 'AMAZON MKTP US*T89ZL', 34.18, daysAgo(27), 'Shops')
  add(creditId, 'AMAZON MKTP US*RR2QM', 61.42, daysAgo(9), 'Shops')
  add(creditId, 'TARGET 00021032', 47.83, daysAgo(35), 'Shops')

  // --- Internal moves: excluded from money in/out, visible in ledger --------
  for (const d of [66, 36, 6]) {
    add(checkingId, 'ONLINE TRANSFER TO SAVINGS ...5150', 200.0, daysAgo(d), 'Transfer')
    add(savingsId, 'ONLINE TRANSFER FROM CHECKING ...2210', -200.0, daysAgo(d), 'Transfer')
  }
  for (const d of [80, 50, 20]) {
    add(checkingId, 'CHASE CREDIT CRD AUTOPAY', 450.0, daysAgo(d), 'Payment')
    add(creditId, 'AUTOMATIC PAYMENT - THANK YOU', -450.0, daysAgo(d), 'Payment')
  }

  return rows
}

async function seed() {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO users (
         id, email, name, subscription_tier, proactive_notifications_enabled,
         pay_cadence, next_payday_on, payday_source, payday_updated_at
       )
       VALUES ($1, $2, 'Demo User', 'free', false, 'biweekly', $3, 'user', NOW())
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             subscription_tier = 'free',
             proactive_notifications_enabled = false,
             pay_cadence = 'biweekly',
             next_payday_on = EXCLUDED.next_payday_on,
             payday_source = 'user',
             payday_updated_at = NOW()`,
      [DEMO_USER_ID, DEMO_EMAIL, daysAhead(11)]
    )

    await wipeDemoRows(client)

    const itemResult = await client.query(
      `INSERT INTO plaid_items (user_id, plaid_access_token, plaid_external_item_id, institution_name, last_synced_at)
       VALUES ($1, $2, 'demo-item-1', 'First Demo Bank', NOW())
       RETURNING id`,
      [DEMO_USER_ID, DEMO_ACCESS_TOKEN]
    )
    const plaidItemId = itemResult.rows[0].id

    async function insertAccount(plaidAccountId, name, type, current, available) {
      const result = await client.query(
        `INSERT INTO accounts (
           user_id, plaid_item_id, plaid_account_id, bank_name, account_name,
           account_type, balance_current, balance_available, currency, last_synced_at
         )
         VALUES ($1, $2, $3, 'First Demo Bank', $4, $5, $6, $7, 'USD', NOW())
         RETURNING id`,
        [DEMO_USER_ID, plaidItemId, plaidAccountId, name, type, current, available]
      )
      return result.rows[0].id
    }

    const checkingId = await insertAccount('demo-acct-checking', 'Everyday Checking', 'checking', 2340.52, 2290.52)
    const savingsId = await insertAccount('demo-acct-savings', 'Rainy Day Savings', 'savings', 5150.0, 5150.0)
    const creditId = await insertAccount('demo-acct-credit', 'Cash Rewards Card', 'credit card', 642.18, 3357.82)

    const rows = buildTransactions({ checkingId, savingsId, creditId })

    for (const row of rows) {
      await client.query(
        `INSERT INTO transactions (user_id, account_id, plaid_transaction_id, amount, name, category, date, pending)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
        [DEMO_USER_ID, row.accountId, row.plaidTransactionId, row.amount, row.name, row.category, row.date]
      )
    }

    await client.query('COMMIT')

    console.log(`Seeded demo user '${DEMO_USER_ID}' with 3 accounts and ${rows.length} transactions (${daysAgo(87)} → ${daysAgo(3)}).`)
    console.log('Run the API with DEMO_MODE=1 and send header x-soverm-demo: 1 to browse it.')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

try {
  await seed()
  process.exit(0)
} catch (err) {
  console.error('Demo seed failed:', err.message)
  process.exit(1)
}
