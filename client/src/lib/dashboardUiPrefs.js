/*
 * Dashboard UI preferences — persisted in localStorage so returning users
 * see a cleaner layout (collapsed onboarding, dismissed security note).
 *
 * Keys are scoped by Clerk userId when provided so account switches on the
 * same browser don’t reuse each other’s UI prefs.
 */

import {
  readUserScopedFlag,
  writeUserScopedFlag,
} from './userScopedStorage.js'

export const DASHBOARD_VISITED_KEY = 'soverm:dashboard-visited'
export const ONBOARDING_COLLAPSED_KEY = 'soverm:dashboard-onboarding-collapsed'
export const SECURITY_NOTE_DISMISSED_KEY = 'soverm:security-note-dismissed'

export function getInitialOnboardingCollapsed(userId) {
  const stored = readUserScopedFlag(ONBOARDING_COLLAPSED_KEY, userId)
  if (stored === '0') {
    return false
  }
  if (stored === '1') {
    return true
  }

  return readUserScopedFlag(DASHBOARD_VISITED_KEY, userId) === '1'
}

export function setOnboardingCollapsedPreference(collapsed, userId) {
  writeUserScopedFlag(ONBOARDING_COLLAPSED_KEY, userId, collapsed ? '1' : '0')
}

export function markDashboardVisited(userId) {
  writeUserScopedFlag(DASHBOARD_VISITED_KEY, userId, '1')
}

export function isSecurityNoteDismissed(userId) {
  return readUserScopedFlag(SECURITY_NOTE_DISMISSED_KEY, userId) === '1'
}

export function dismissSecurityNote(userId) {
  writeUserScopedFlag(SECURITY_NOTE_DISMISSED_KEY, userId, '1')
}
