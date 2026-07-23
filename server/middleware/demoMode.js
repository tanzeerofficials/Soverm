/*
 * DEMO MODE (read-only investor/product demo)
 *
 * What this does:
 * - When the server runs with DEMO_MODE=1 AND a request carries the header
 *   `x-soverm-demo: 1`, the request is treated as authenticated as the seeded
 *   demo user (see scripts/seed-demo-user.js) without touching Clerk.
 * - Demo sessions are read-only except for the two AI features worth showing
 *   live (insight generation, chat). Plaid routes are always blocked.
 *
 * Security invariants (do not weaken):
 * - The demo user id is HARDCODED. Nothing from the request can choose which
 *   user the session impersonates.
 * - Without DEMO_MODE=1 in the environment this middleware is inert, so the
 *   header does nothing in normal production deployments.
 *
 * How the Clerk bypass works (pinned to @clerk/express 2.x behavior):
 * clerkMiddleware/requireAuth skip authentication when `req.auth` is already a
 * function branded with Symbol.for('@clerk/express.auth'), and getAuth() returns
 * `req.auth()` as long as the object's tokenType is accepted ('session_token').
 * We brand our own handler with that global symbol. scripts/test-demo-mode.js
 * exercises this against the real @clerk/express package, so a Clerk upgrade
 * that changes the mechanism fails loudly in CI instead of silently 401ing.
 */

const CLERK_AUTH_BRAND = Symbol.for('@clerk/express.auth')

export const DEMO_USER_ID = 'demo_user'
export const DEMO_HEADER = 'x-soverm-demo'

/** Read at request time (not module load) so tests and ops can toggle. */
export function isDemoModeEnabled() {
  return process.env.DEMO_MODE === '1'
}

export function isDemoRequest(req) {
  return isDemoModeEnabled() && req.headers?.[DEMO_HEADER] === '1'
}

function buildDemoAuthObject() {
  return {
    tokenType: 'session_token',
    isAuthenticated: true,
    userId: DEMO_USER_ID,
    sessionId: 'demo-session',
    sessionClaims: {},
    orgId: null,
    orgRole: null,
    orgSlug: null,
    actor: null,
    has: () => false,
    getToken: async () => null,
    debug: () => ({ demo: true }),
  }
}

/** Mutations allowed in demo: the AI features we demo live. Everything else 403s. */
const DEMO_WRITE_ALLOWLIST = [
  /^\/api\/insights\/generate\/?$/,
  /^\/api\/chat\/[^/]+\/?$/,
  /^\/api\/before-you-spend\/?$/,
  /^\/api\/expense-analyzer\/narrative\/?$/,
]

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isDemoWriteAllowed(path) {
  return DEMO_WRITE_ALLOWLIST.some((pattern) => pattern.test(path))
}

/**
 * Mount BEFORE clerkMiddleware. For valid demo requests it enforces the
 * read-only policy, then brands req.auth so Clerk treats the request as an
 * authenticated session for DEMO_USER_ID.
 */
export function demoMode() {
  return (req, res, next) => {
    if (!isDemoRequest(req)) {
      return next()
    }

    const path = req.path || req.url

    if (path.startsWith('/api/plaid')) {
      return res.status(403).json({
        error: 'demo_read_only',
        message: 'Bank connections are disabled in the demo.',
      })
    }

    if (!READ_METHODS.has(req.method) && !isDemoWriteAllowed(path)) {
      return res.status(403).json({
        error: 'demo_read_only',
        message: 'This action is disabled in the demo. Sign up to use it with your own data.',
      })
    }

    const demoAuth = buildDemoAuthObject()
    req.auth = Object.assign(() => demoAuth, { [CLERK_AUTH_BRAND]: true })
    req.sovermDemo = true

    return next()
  }
}
