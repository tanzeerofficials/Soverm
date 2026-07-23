/*
 * DEMO SESSION (client side of server/middleware/demoMode.js)
 *
 * A demo session is a sessionStorage flag — no Clerk account involved. While
 * active, apiRequest.js sends `x-soverm-demo: 1` instead of a Bearer token and
 * the server answers as the seeded read-only demo user.
 *
 * Only meaningful when the build was made with VITE_DEMO_MODE=1 AND the API
 * runs with DEMO_MODE=1; otherwise the flag is ignored everywhere.
 */

export const DEMO_SESSION_KEY = 'soverm:demo'
export const DEMO_HEADER = 'x-soverm-demo'

/** Build-level switch — controls whether demo UI (landing CTA) exists at all. */
export function isDemoModeAvailable() {
  return import.meta.env.VITE_DEMO_MODE === '1'
}

export function isDemoSession() {
  if (!isDemoModeAvailable()) {
    return false
  }
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function enterDemoSession() {
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, '1')
  } catch {
    // Blocked storage — CTA caller falls back to normal sign-up.
  }
}

export function exitDemoSession() {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // ignore
  }
}
