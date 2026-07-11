/*
 * MONTHLY TRACKERS SCHEMA CACHE
 *
 * Caches information_schema lookups for monthly_trackers so we do not
 * query metadata on every tracker snapshot or CRUD request.
 * Entries expire after SCHEMA_CACHE_TTL_MS so migrations take effect
 * without requiring a process restart.
 */

import db from '../db/index.js'

const SCHEMA_CACHE_TTL_MS = 60_000

const cache = {
  monthlyTrackersTable: null,
  monthlyProgressColumns: null,
  alertThresholdColumns: null,
  checkedAt: 0,
}

function isCacheFresh() {
  return Date.now() - cache.checkedAt < SCHEMA_CACHE_TTL_MS
}

function touchCache() {
  cache.checkedAt = Date.now()
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
  if (cache.monthlyTrackersTable !== null && isCacheFresh()) {
    return cache.monthlyTrackersTable
  }

  cache.monthlyTrackersTable = await tableExists('monthly_trackers')
  touchCache()
  return cache.monthlyTrackersTable
}

export async function hasMonthlyProgressColumns() {
  if (!(await hasMonthlyTrackersTable())) {
    cache.monthlyProgressColumns = false
    return false
  }

  if (cache.monthlyProgressColumns !== null && isCacheFresh()) {
    return cache.monthlyProgressColumns
  }

  cache.monthlyProgressColumns = await columnExists('monthly_trackers', 'monthly_progress_amount')
  touchCache()
  return cache.monthlyProgressColumns
}

export async function hasAlertThresholdColumns() {
  if (!(await hasMonthlyTrackersTable())) {
    cache.alertThresholdColumns = false
    return false
  }

  if (cache.alertThresholdColumns !== null && isCacheFresh()) {
    return cache.alertThresholdColumns
  }

  cache.alertThresholdColumns = await columnExists('monthly_trackers', 'alert_warning_percent')
  touchCache()
  return cache.alertThresholdColumns
}

/** Test helper — clears in-process cache between assertions. */
export function resetMonthlyTrackersSchemaCache() {
  cache.monthlyTrackersTable = null
  cache.monthlyProgressColumns = null
  cache.alertThresholdColumns = null
  cache.checkedAt = 0
}
