/*
 * DATABASE HELPER FILE
 *
 * Postgres is where we permanently save app data (users, accounts, transactions).
 * This file creates one shared connection pool so the server can talk to Postgres.
 *
 * Think of a "pool" like a taxi stand:
 * - Many requests need a database ride
 * - The pool reuses connections instead of opening a brand-new one every time
 */

import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
