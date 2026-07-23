/*
 * MIGRATION PROBES
 *
 * Reusable "is this migration's end-state already present?" checks, shared
 * by the migrate.js runner. Each function ports the exact idempotency check
 * that already lived in that migration's individual run-0XX-*.js script —
 * this is a consolidation of proven logic, not a rewrite from scratch.
 */

export async function tableExists(db, tableName) {
  const result = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  return result.rows.length > 0
}

export async function columnExists(db, tableName, columnName) {
  const result = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  )
  return result.rows.length > 0
}

export async function columnDataType(db, tableName, columnName) {
  const result = await db.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  )
  return result.rows[0]?.data_type ?? null
}

export async function columnIsNullable(db, tableName, columnName) {
  const result = await db.query(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  )
  return result.rows[0]?.is_nullable === 'YES'
}

export async function indexExists(db, indexName) {
  const result = await db.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [indexName]
  )
  return result.rows.length > 0
}

export async function constraintDefinitionContains(db, tableName, constraintName, requiredSubstrings) {
  const result = await db.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE n.nspname = 'public' AND t.relname = $1 AND c.conname = $2`,
    [tableName, constraintName]
  )
  const definition = result.rows[0]?.definition ?? ''
  return requiredSubstrings.every((needle) => definition.includes(needle))
}
