/*
 * Dashboard UI preferences — persisted in localStorage so returning users
 * see a cleaner layout (collapsed onboarding, dismissed security note).
 */

export const DASHBOARD_VISITED_KEY = 'soverm:dashboard-visited'
export const ONBOARDING_COLLAPSED_KEY = 'soverm:dashboard-onboarding-collapsed'
export const SECURITY_NOTE_DISMISSED_KEY = 'soverm:security-note-dismissed'

export function getInitialOnboardingCollapsed() {
  try {
    const stored = localStorage.getItem(ONBOARDING_COLLAPSED_KEY)
    if (stored === '0') {
      return false
    }
    if (stored === '1') {
      return true
    }

    return localStorage.getItem(DASHBOARD_VISITED_KEY) === '1'
  } catch {
    return false
  }
}

export function setOnboardingCollapsedPreference(collapsed) {
  try {
    localStorage.setItem(ONBOARDING_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // localStorage unavailable
  }
}

export function markDashboardVisited() {
  try {
    localStorage.setItem(DASHBOARD_VISITED_KEY, '1')
  } catch {
    // localStorage unavailable
  }
}

export function isSecurityNoteDismissed() {
  try {
    return localStorage.getItem(SECURITY_NOTE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissSecurityNote() {
  try {
    localStorage.setItem(SECURITY_NOTE_DISMISSED_KEY, '1')
  } catch {
    // localStorage unavailable
  }
}
