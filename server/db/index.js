/*
 * DATABASE HELPER FILE
 *
 * Postgres is where we permanently save app data (users, accounts, transactions).
 * This file creates one shared connection pool so the server can talk to Postgres.
 *
 * Think of a "pool" like a taxi stand:
 * - Many requests need a database ride
 * - The pool reuses connections instead of opening a brand-new one every time
 *
 * TLS:
 * - Production enables SSL unless DATABASE_SSL=0 or the URL has sslmode=disable.
 * - Prefer sslmode=require (or verify-full) on the Railway DATABASE_URL.
 * - Railway's managed cert may need rejectUnauthorized=false; set
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=0 if the driver rejects the cert chain.
 */

import pg from 'pg'

const { Pool } = pg

function shouldUseSsl(connectionString) {
  if (process.env.DATABASE_SSL === '0') {
    return false
  }
  if (/[?&]sslmode=disable\b/i.test(connectionString)) {
    return false
  }
  if (process.env.DATABASE_SSL === '1') {
    return true
  }
  if (/[?&]sslmode=(require|verify-ca|verify-full)\b/i.test(connectionString)) {
    return true
  }
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production'
  )
}

const connectionString = process.env.DATABASE_URL || ''
const useSsl = shouldUseSsl(connectionString)

export const pool = new Pool({
  connectionString,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== '0',
        },
      }
    : {}),
})

/*
 * query(sql, params)
 *
 * What it does:
 * - Sends SQL to Postgres and returns the result.
 *
 * Why we need it:
 * - Routes should not manage low-level connection details themselves.
 * - They can just call db.query(...) with SQL + values.
 *
 * Example:
 * db.query('SELECT * FROM users WHERE id = $1', [userId])
 */
export async function query(sql, params) {
  return pool.query(sql, params)
}

export default pool
