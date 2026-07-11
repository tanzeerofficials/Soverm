import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container) {
  if (!container) {
    return []
  }
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) =>
      el instanceof HTMLElement &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.tabIndex !== -1 &&
      el.offsetParent !== null
  )
}

/*
 * What this does: keeps Tab / Shift+Tab cycling inside a modal container
 * so keyboard users cannot reach the dashboard behind the dialog.
 *
 * Why: aria-modal alone does not trap focus in most browsers.
 */
export function useFocusTrap(isActive, containerRef) {
  const previouslyFocusedRef = useRef(null)

  useEffect(() => {
    if (!isActive) {
      return
    }

    previouslyFocusedRef.current = document.activeElement

    const container = containerRef.current
    if (!container) {
      return
    }

    const focusables = getFocusableElements(container)
    const initial =
      focusables.find((el) => el.getAttribute('data-autofocus') === 'true') ||
      focusables[0]
    initial?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key !== 'Tab') {
        return
      }

      const items = getFocusableElements(container)
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (active === last || !container.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      const previous = previouslyFocusedRef.current
      if (previous instanceof HTMLElement) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [isActive, containerRef])
}

export default useFocusTrap
