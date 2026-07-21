/*
 * CONTENT SECURITY POLICY (shared allowlist)
 *
 * What this does:
 * - Builds the Content-Security-Policy header string for the React app
 *
 * Why:
 * - CSP tells the browser which scripts/styles/APIs may load — a major XSS defense
 * - Soverm loads Clerk, Plaid Link, Google Fonts, and optionally Sentry/PostHog;
 *   those hosts must be allowlisted or login / bank link break
 *
 * Where it applies:
 * - Production: Vercel headers (client/vercel.json) — this is the document users load
 * - API (Railway): Helmet uses a separate, stricter JSON-API policy (no HTML UI)
 *
 * Bigger picture:
 * - Browsers enforce CSP on the HTML document, not on JSON API responses.
 *   So the SPA host (Vercel) is the important place for this policy.
 */

/** Origins our frontend is allowed to talk to (fetch / XHR / WebSocket). */
export const CSP_CONNECT_SRC = [
  "'self'",
  // Express API (Railway defaults + common custom hosts — add yours in EXTRA if needed)
  'https://*.up.railway.app',
  'https://*.railway.app',
  // Clerk Frontend API + telemetry
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://clerk.accounts.dev',
  'https://api.clerk.com',
  'https://clerk-telemetry.com',
  'https://*.clerk-telemetry.com',
  // Plaid Link
  'https://*.plaid.com',
  'https://production.plaid.com',
  'https://sandbox.plaid.com',
  // Stripe (Checkout / Portal / Elements if added later)
  'https://api.stripe.com',
  'https://*.stripe.com',
  // Sentry browser SDK
  'https://*.ingest.sentry.io',
  'https://*.ingest.us.sentry.io',
  'https://*.sentry.io',
  // PostHog
  'https://*.posthog.com',
  'https://us.i.posthog.com',
  'https://eu.i.posthog.com',
]

export const CSP_SCRIPT_SRC = [
  "'self'",
  /*
   * Clerk still injects runtime bootstrap helpers that need an inline path.
   * Clerk's React SDK can take a nonce, but that requires *per-request* CSP
   * headers. This SPA ships a static policy via Vercel vercel.json, so we
   * cannot mint a fresh nonce on each document load without Edge Middleware
   * + wiring nonce through ClerkProvider. Until that exists, 'unsafe-inline'
   * stays required for auth; first-party code loads from 'self' only
   * (theme-boot.js + Vite bundles — no inline <script> in index.html).
   */
  "'unsafe-inline'",
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://clerk.accounts.dev',
  'https://challenges.cloudflare.com',
  // Plaid Link initializer (index.html)
  'https://cdn.plaid.com',
  // Stripe.js if hosted checkout scripts are ever embedded
  'https://js.stripe.com',
  'https://*.js.stripe.com',
]

export const CSP_STYLE_SRC = [
  "'self'",
  // Clerk runtime CSS-in-JS requires this (Clerk docs)
  "'unsafe-inline'",
  'https://fonts.googleapis.com',
]

export const CSP_FONT_SRC = ["'self'", 'data:', 'https://fonts.gstatic.com']

export const CSP_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  'https://img.clerk.com',
  'https://*.clerk.com',
  'https://*.clerk.accounts.dev',
]

export const CSP_FRAME_SRC = [
  "'self'",
  'https://challenges.cloudflare.com',
  'https://cdn.plaid.com',
  'https://*.plaid.com',
  'https://js.stripe.com',
  'https://*.js.stripe.com',
  'https://hooks.stripe.com',
  'https://checkout.stripe.com',
  'https://billing.stripe.com',
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
]

export const CSP_WORKER_SRC = ["'self'", 'blob:']

export const CSP_FORM_ACTION = [
  "'self'",
  'https://checkout.stripe.com',
  'https://billing.stripe.com',
  'https://*.stripe.com',
]

/**
 * @param {{ extraConnectSrc?: string[] }} [options]
 * @returns {Record<string, string[]>}
 */
export function buildCspDirectives({ extraConnectSrc = [] } = {}) {
  const extra = extraConnectSrc
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return String(value || '').trim()
      }
    })
    .filter(Boolean)

  const connectSrc = [...new Set([...CSP_CONNECT_SRC, ...extra])]

  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'script-src': CSP_SCRIPT_SRC,
    'style-src': CSP_STYLE_SRC,
    'font-src': CSP_FONT_SRC,
    'img-src': CSP_IMG_SRC,
    'connect-src': connectSrc,
    'frame-src': CSP_FRAME_SRC,
    'worker-src': CSP_WORKER_SRC,
    'form-action': CSP_FORM_ACTION,
    'upgrade-insecure-requests': [],
  }
}

/**
 * Serialize directives into a single CSP header value.
 */
export function buildContentSecurityPolicyHeader(options = {}) {
  const directives = buildCspDirectives(options)

  return Object.entries(directives)
    .map(([name, values]) => {
      if (!values || values.length === 0) {
        return name
      }
      return `${name} ${values.join(' ')}`
    })
    .join('; ')
}
