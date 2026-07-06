/*
 * TOAST NOTIFICATIONS
 *
 * Lightweight, auto-dismissing feedback with glass styling and slide-in motion.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const TYPE_STYLES = {
  success: {
    container: 'border-emerald-500/30 bg-surface/95 text-fg',
    icon: 'text-emerald-400',
    bar: 'bg-emerald-500',
  },
  error: {
    container: 'border-red-500/30 bg-surface/95 text-fg',
    icon: 'text-red-400',
    bar: 'bg-red-500',
  },
  info: {
    container: 'border-border-default bg-surface/95 text-fg',
    icon: 'text-ai-soft',
    bar: 'bg-ai',
  },
}

function ToastIcon({ type }) {
  if (type === 'success') {
    return (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (type === 'error') {
    return (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-4.5A.75.75 0 0010 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  )
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
    }, 3200)
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

  if (!toast) {
    return null
  }

  const styles = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 ease-out sm:left-auto sm:right-6 ${styles.container} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>
        <ToastIcon type={toast.type} />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 ${styles.bar} opacity-70`}
        aria-hidden="true"
      />
    </div>
  )
}
