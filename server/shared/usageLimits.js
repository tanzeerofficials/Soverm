/*
 * USAGE LIMITS (shared)
 *
 * Single source of truth for free-tier limits and Pro pricing.
 * Imported by the Express API and the Vite client so landing-page
 * copy never drifts from what the backend actually enforces.
 *
 * Lives under server/shared/ so Railway (root directory: server) includes it in deploys.
 */

export const FREE_DAILY_INSIGHT_LIMIT = 1
export const FREE_HISTORY_DAYS = 7
export const PRO_MONTHLY_PRICE = 6.99

/** Hard safety ceiling for insight generation (all tiers). Free tier product limit is lower. */
export const PRO_DAILY_INSIGHT_CEILING = 30

/** Max user chat messages per calendar day on the free tier. */
export const FREE_DAILY_CHAT_LIMIT = 5

/** Max user chat messages per rolling hour for Pro (Claude cost guard). */
export const CHAT_HOURLY_LIMIT = 20
