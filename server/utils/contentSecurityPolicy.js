/*
 * CONTENT SECURITY POLICY — API
 *
 * The React app’s real CSP lives on Vercel (see client/src/lib/contentSecurityPolicy.js).
 * This Helmet policy applies to the Express API only: the API returns JSON, so we
 * use a tight default that blocks accidental script execution if any HTML were ever served.
 */

import helmet from 'helmet'

/**
 * @param {{ reportOnly?: boolean }} [options]
 */
export function buildApiContentSecurityPolicy({ reportOnly = false } = {}) {
  return {
    useDefaults: false,
    reportOnly,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  }
}

export function createSecurityHeaders({
  reportOnly = process.env.CSP_REPORT_ONLY === 'true',
} = {}) {
  return helmet({
    contentSecurityPolicy: buildApiContentSecurityPolicy({ reportOnly }),
    // One-year HSTS for the API origin (Railway). SPA edge HSTS is set on Vercel.
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // COEP can break third-party embeds if this API ever served HTML UI.
    crossOriginEmbedderPolicy: false,
  })
}
