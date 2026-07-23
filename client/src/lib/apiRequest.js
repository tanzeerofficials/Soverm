/*
 * API REQUEST HEADERS (single choke point for auth vs demo)
 *
 * Every API call site builds its headers here. Normal sessions send the Clerk
 * Bearer token; demo sessions (lib/demoSession.js) send the read-only demo
 * header instead. Keeping this in one place is what makes demo mode safe to
 * reason about — no fetch in the app hand-rolls its Authorization header.
 */

import { DEMO_HEADER, isDemoSession } from './demoSession.js'

/**
 * @param {string | null} token - resolved Clerk token (await getToken())
 * @param {Record<string, string>} extra - e.g. { 'Content-Type': 'application/json' }
 */
export function authHeaders(token, extra = {}) {
  if (isDemoSession()) {
    return { [DEMO_HEADER]: '1', ...extra }
  }
  return { Authorization: `Bearer ${token}`, ...extra }
}
