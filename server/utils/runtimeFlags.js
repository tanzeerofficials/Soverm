/*
 * RUNTIME FLAGS
 *
 * Opt-in switches that must never turn on just because NODE_ENV is missing.
 * Railway (or any host) without NODE_ENV=production used to expose /test-db
 * and localhost CORS — this file makes those explicit.
 */

/**
 * Dev-only HTTP helpers (/test-db, /sentry-test, /protected) and the
 * automatic localhost CORS allowlist. Set ENABLE_DEV_ENDPOINTS=1 locally.
 * Never set this on Railway production.
 */
export function areDevEndpointsEnabled() {
  return process.env.ENABLE_DEV_ENDPOINTS === '1'
}
