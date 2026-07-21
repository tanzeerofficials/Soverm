/*
 * THEME PREFERENCE
 *
 * What this does: resolves and applies light/dark on <html data-theme>.
 * Why: light is a second *app* theme; the marketing landing (`/`) deliberately
 * stays dark (see ThemeContext forceDarkMarketing) so brand photography and
 * hero wash stay consistent. Stored light preference is preserved — landing
 * applies dark with persist:false, then restores when you leave `/`.
 * Order: explicit localStorage → prefers-color-scheme → dark.
 *
 * Canonical product name: **Soverm** (wordmark SOVERM). Not Sovrm / Sovrn.
 */

export const THEME_STORAGE_KEY = 'soverm:theme'
export const THEME_LIGHT = 'light'
export const THEME_DARK = 'dark'

export function isValidTheme(value) {
  return value === THEME_LIGHT || value === THEME_DARK
}

/** Read an explicit user choice, or null if unset. */
export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isValidTheme(stored)) {
      return stored
    }
  } catch {
    // private mode / blocked storage
  }

  return null
}

/** OS preference when the user has not chosen yet. */
export function getSystemTheme() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return THEME_LIGHT
    }
  } catch {
    // ignore
  }

  return THEME_DARK
}

/** Stored choice, else OS, else dark. */
export function resolveInitialTheme() {
  return getStoredTheme() ?? getSystemTheme()
}

/**
 * Apply theme to the document.
 * @param {'light'|'dark'} theme
 * @param {{ persist?: boolean }} [options] — persist false for temporary landing force-dark
 */
export function applyTheme(theme, { persist = true } = {}) {
  const next = isValidTheme(theme) ? theme : THEME_DARK
  document.documentElement.setAttribute('data-theme', next)
  document.documentElement.style.colorScheme = next

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', next === THEME_DARK ? '#0A0F1C' : '#EEF0F4')
  }

  if (document.body) {
    document.body.style.backgroundColor = next === THEME_DARK ? '#0A0F1C' : '#EEF0F4'
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return next
}

export function toggleTheme(current) {
  return applyTheme(current === THEME_DARK ? THEME_LIGHT : THEME_DARK)
}
