/*
 * Shared deprecation notice for the old numbered migrate:0XX aliases.
 * They still work standalone during the transition — prefer `npm run migrate`.
 */

const num = process.argv[2]
console.warn(
  `[deprecated] npm run migrate:${num} — use "npm run migrate" instead (single runner, tracks applied state in schema_migrations). This alias will be removed in a future release.`
)
