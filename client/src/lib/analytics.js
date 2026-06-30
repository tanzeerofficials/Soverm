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

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let enabled = false

export function initAnalytics() {
  if (!POSTHOG_KEY || enabled) {
    return
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: import.meta.env.VITE_POSTHOG_SESSION_RECORDING !== 'true',
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

const TRACKED_PAGES = {
  '/': 'landing',
  '/dashboard': 'dashboard',
  '/history': 'history',
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
