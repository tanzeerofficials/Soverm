/*
 * TOAST NOTIFICATIONS
 *
 * Lightweight, auto-dismissing feedback for informational outcomes
 * (e.g. "Synced 3 new transactions"). Pair useToast + Toast in any page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const TYPE_STYLES = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-[#1A2236] border border-[#1E2D45]',
}

const TYPE_ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const timeoutRef = useRef(null)

  const showToast = useCallback((message, type = 'info') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setToast({ message, type })

    timeoutRef.current = setTimeout(() => {
      setToast(null)
      timeoutRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { toast, showToast }
}

export function Toast({ toast }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) {
      setVisible(false)
      return
    }

    setVisible(false)
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [toast])

  if (!toast) return null

  const styles = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info
  const icon = TYPE_ICONS[toast.type] ?? TYPE_ICONS.info

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg p-4 text-sm font-medium text-white shadow-lg transition-all duration-300 ease-out ${styles} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {icon}
      </span>
      <span>{toast.message}</span>
    </div>
  )
}
