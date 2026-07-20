/*
 * Pre-React theme bootstrap (FOUC prevention).
 * Kept as a first-party static file so CSP can allow it via 'self'
 * without relying on script-src 'unsafe-inline' for our own code.
 * Clerk still needs 'unsafe-inline' for its injected bootstrap scripts.
 */
;(function () {
  try {
    var stored = localStorage.getItem('soverm:theme')
    var t =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.style.colorScheme = t
    document.body.style.backgroundColor = t === 'dark' ? '#0A0F1C' : '#EEF0F4'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0A0F1C' : '#EEF0F4')
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.body.style.backgroundColor = '#0A0F1C'
  }
})()
