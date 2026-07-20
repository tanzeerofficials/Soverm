/*
 * THEME CONTEXT
 *
 * What this does: keeps React in sync with data-theme on <html>.
 * Why: navbar / Settings toggles can flip light↔dark without a full reload.
 * On `/` (marketing landing), force dark without overwriting the stored preference.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  THEME_DARK,
  THEME_LIGHT,
  applyTheme,
  resolveInitialTheme,
} from '../lib/themePrefs.js'

const ThemeContext = createContext({
  theme: THEME_DARK,
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const location = useLocation()
  const [theme, setThemeState] = useState(() => resolveInitialTheme())
  const forceDarkMarketing = location.pathname === '/'

  useEffect(() => {
    if (forceDarkMarketing) {
      applyTheme(THEME_DARK, { persist: false })
      return
    }
    applyTheme(theme, { persist: true })
  }, [theme, forceDarkMarketing])

  function setTheme(next) {
    setThemeState(applyTheme(next, { persist: true }))
  }

  function toggleTheme() {
    setThemeState((current) => {
      const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK
      return applyTheme(next, { persist: true })
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { THEME_DARK, THEME_LIGHT }
