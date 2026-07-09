/*
 * MONTHLY TRACKERS SCHEMA CACHE
 *
 * Caches information_schema lookups for monthly_trackers so we do not
 * query metadata on every tracker snapshot or CRUD request.
 * Restart the server after running migrations 013/014 in dev.
 */

import db from '../db/index.js'

const cache = {
  monthlyTrackersTable: null,
  monthlyProgressColumns: null,
}

async function tableExists(tableName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  )

  return result.rows.length > 0
}

async function columnExists(tableName, columnName) {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName]
  )

  return result.rows.length > 0
}

export async function hasMonthlyTrackersTable() {
  if (cache.monthlyTrackersTable !== null) {
    return cache.monthlyTrackersTable
  }

  cache.monthlyTrackersTable = await tableExists('monthly_trackers')
  return cache.monthlyTrackersTable
}

export async function hasMonthlyProgressColumns() {
  if (!(await hasMonthlyTrackersTable())) {
    cache.monthlyProgressColumns = false
    return false
  }

  if (cache.monthlyProgressColumns !== null) {
    return cache.monthlyProgressColumns
  }

  cache.monthlyProgressColumns = await columnExists('monthly_trackers', 'monthly_progress_amount')
  return cache.monthlyProgressColumns
}

/** Test helper — clears in-process cache between assertions. */
export function resetMonthlyTrackersSchemaCache() {
  cache.monthlyTrackersTable = null
  cache.monthlyProgressColumns = null
}
