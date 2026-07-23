/*
 * ANALYTICS
 *
 * Thin PostHog wrapper — only fires when VITE_POSTHOG_KEY is set.
 * Autocapture and session recording are off by default; we send only
 * explicit event names (no balances, transactions, or account data).
 *
 * Privacy policy: keep client/src/pages/PrivacyPage.jsx "Analytics" section
 * in sync if events or data sent here change.
 */

import posthog from 'posthog-js'

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
const POSTHOG_KEY = env?.VITE_POSTHOG_KEY
const POSTHOG_HOST = env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics() {
  if (!POSTHOG_KEY || enabled) {
    return
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: env?.VITE_POSTHOG_SESSION_RECORDING !== 'true',
    person_profiles: 'identified_only',
    persistence: 'localStorage',
  })

  enabled = true
}

function track(event, properties = {}) {
  if (!enabled) {
    return
  }
  posthog.capture(event, properties)
}

/**
 * Ties events to the pseudonymous Clerk user id so funnels and retention
 * cohorts count unique people. No email/name — id only (see PrivacyPage).
 */
export function identifyUser(userId) {
  if (!enabled || !userId) {
    return
  }
  posthog.identify(userId)
}

/*
 * CANONICAL ACTIVATION FUNNEL
 *
 * These five events ARE the investor/retention funnel — treat the names as a
 * stable contract with PostHog dashboards; never rename without migrating the
 * saved funnel there.
 *
 *   1. funnel_signup_completed        — first session after Clerk sign-up
 *   2. funnel_bank_linked             — Plaid public-token exchange succeeded
 *   3. funnel_first_insight_generated — first successful insight for this user
 *   4. funnel_weekly_review_viewed    — weekly review loaded with data
 *   5. funnel_chat_message_sent       — Ask Soverm message sent successfully
 *
 * Steps 1 and 3 are deduped with per-user localStorage markers; a second
 * device may re-send them, which is harmless — PostHog funnels count unique
 * persons, not events.
 */

function onceKey(step, userId) {
  return `soverm:funnel:${step}:${userId}`
}

function trackOncePerUser(step, event, userId, properties = {}) {
  if (!enabled || !userId) {
    return
  }
  try {
    const key = onceKey(step, userId)
    if (localStorage.getItem(key)) {
      return
    }
    localStorage.setItem(key, new Date().toISOString())
  } catch {
    // Private mode / blocked storage — still send; PostHog dedupes by person.
  }
  track(event, properties)
}

/** Fire on the first authenticated session of a freshly created account. */
export function trackFunnelSignupCompleted(userId) {
  trackOncePerUser('signup', 'funnel_signup_completed', userId)
}

export function trackFunnelBankLinked({ accountsConnected } = {}) {
  track('funnel_bank_linked', { accountsConnected: accountsConnected ?? null })
}

export function trackFunnelFirstInsightGenerated(userId) {
  trackOncePerUser('first-insight', 'funnel_first_insight_generated', userId)
}

export function trackFunnelWeeklyReviewViewed() {
  track('funnel_weekly_review_viewed')
}

/** @param {'general' | 'insight'} thread */
export function trackFunnelChatMessageSent(thread) {
  track('funnel_chat_message_sent', { thread })
}

/** Landing "View live demo" click — measures demo-driven interest pre-signup. */
export function trackDemoModeEntered() {
  track('demo_mode_entered')
}

const TRACKED_PAGES = {
  '/': 'landing',
  '/dashboard': 'dashboard',
  '/history': 'history',
  '/weekly-review': 'weekly_review',
  '/month-condition': 'month_condition',
}

export function trackPageView(pathname) {
  const page = TRACKED_PAGES[pathname]
  if (!page) {
    return
  }
  track('page_view', { page })
}

export function trackConnectBankClick() {
  track('connect_bank_click')
}

export function trackGenerateInsightClick() {
  track('generate_insight_click')
}

/** @param {'success' | 'paywall' | 'error'} outcome */
export function trackGenerateInsightResult(outcome) {
  track('generate_insight_result', { outcome })
}

/** @param {'pricing' | 'history' | 'dashboard_paywall'} source */
export function trackUpgradeProClick(source) {
  track('upgrade_pro_click', { source })
}

/** @param {'weeklyReview' | 'actionTaken' | 'monthLetter' | 'connected' | 'payday'} step */
export function trackActivationStep(step) {
  track('activation_step', { step })
}

export function trackWeeklyReviewView() {
  track('weekly_review_view')
}

export function trackMonthLetterView() {
  track('month_letter_view')
}

export function trackWelcomeIntroView() {
  track('intro_modal_view')
}

/** @param {'skip' | 'close' | 'connect'} reason */
export function trackWelcomeIntroDismiss(reason) {
  track('intro_modal_dismiss', { reason })
}

export function trackWelcomeIntroConnect() {
  track('intro_modal_connect')
}
