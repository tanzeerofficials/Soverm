/*
 * Lazy-load Plaid Link’s CDN script.
 *
 * Why: marketing-page bounces should not pay for Plaid Link up front.
 * react-plaid-link can inject the script itself, but we only mount that hook
 * after sign-in — this helper is the explicit gate if we need the script first.
 */

const PLAID_LINK_SCRIPT_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
const SCRIPT_ATTR = 'data-soverm-plaid-link'

let loadPromise = null

export function ensurePlaidLinkScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if (window.Plaid) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${SCRIPT_ATTR}]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Plaid Link script failed to load')))
      if (window.Plaid) {
        resolve()
      }
      return
    }

    const script = document.createElement('script')
    script.src = PLAID_LINK_SCRIPT_URL
    script.async = true
    script.setAttribute(SCRIPT_ATTR, 'true')
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Plaid Link script failed to load'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
