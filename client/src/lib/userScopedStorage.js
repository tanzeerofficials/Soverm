/*
 * USER-SCOPED LOCAL STORAGE
 *
 * What this does:
 * - Builds localStorage keys like "soverm:attention-dismissals:user_abc123"
 * - Can copy an old shared key into the user-scoped key once (migration)
 *
 * Why we need it:
 * - Browser localStorage is shared by everyone on that browser — not by Clerk
 *   account. Without a user id in the key, User A’s dismissals look like User B’s.
 *
 * Bigger picture:
 * - Dashboard prefs (onboarding collapsed, security note) and Needs Attention
 *   dismissals are client-only preferences. Scoping them per user keeps shared
 *   computers and account switches from leaking UI state.
 *
 * Concept: Namespacing. Same idea as folders — same file name, different path.
 */

export function userScopedStorageKey(baseKey, userId) {
  if (!userId) {
    return baseKey
  }

  return `${baseKey}:${userId}`
}

/**
 * Reads JSON from a user-scoped key. If empty and a legacy (global) key has
 * data, copies it into the scoped key so existing single-user prefs aren’t lost.
 */
export function readUserScopedJson(baseKey, userId, fallback = {}) {
  const scopedKey = userScopedStorageKey(baseKey, userId)

  try {
    const scopedRaw = localStorage.getItem(scopedKey)
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw)
      return parsed && typeof parsed === 'object' ? parsed : fallback
    }

    if (userId) {
      const legacyRaw = localStorage.getItem(baseKey)
      if (legacyRaw) {
        localStorage.setItem(scopedKey, legacyRaw)
        const parsed = JSON.parse(legacyRaw)
        return parsed && typeof parsed === 'object' ? parsed : fallback
      }
    }

    return fallback
  } catch {
    return fallback
  }
}

export function writeUserScopedJson(baseKey, userId, value) {
  try {
    localStorage.setItem(userScopedStorageKey(baseKey, userId), JSON.stringify(value))
  } catch {
    // localStorage unavailable (private mode, quota, etc.)
  }
}

export function readUserScopedFlag(baseKey, userId) {
  const scopedKey = userScopedStorageKey(baseKey, userId)

  try {
    const scoped = localStorage.getItem(scopedKey)
    if (scoped != null) {
      return scoped
    }

    if (userId) {
      const legacy = localStorage.getItem(baseKey)
      if (legacy != null) {
        localStorage.setItem(scopedKey, legacy)
        return legacy
      }
    }

    return null
  } catch {
    return null
  }
}

export function writeUserScopedFlag(baseKey, userId, value) {
  try {
    localStorage.setItem(userScopedStorageKey(baseKey, userId), value)
  } catch {
    // localStorage unavailable
  }
}

export function removeUserScopedKey(baseKey, userId) {
  try {
    localStorage.removeItem(userScopedStorageKey(baseKey, userId))
  } catch {
    // ignore
  }
}
