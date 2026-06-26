/*
 * Global toast context so PlaidLinkProvider and pages share one notification surface.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Toast } from '../components/Toast.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
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

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast toast={toast} />
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}
