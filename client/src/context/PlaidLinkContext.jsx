/*
 * PLAID LINK CONTEXT
 *
 * Keeps a single usePlaidLink instance for the whole app.
 * Plaid's script must only be embedded once per page.
 *
 * What this file does:
 * - Fetches a Plaid link_token when the user is signed in
 * - Exposes open/ready/error/retry so Connect Bank can recover from failures
 * - On successful bank link, invalidates dashboard + trackers + expense + alerts
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAfterAccountChange } from '../lib/queryKeys.js'
import { getCachedAccountCount, markFirstConnectCelebration } from '../lib/firstConnectCelebration.js'
import { useToastContext } from './ToastContext.jsx'
import { captureClientError } from '../lib/sentry.js'

const PlaidLinkContext = createContext(null)

export function PlaidLinkProvider({ children }) {
  const { getToken, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()
  const [linkToken, setLinkToken] = useState(null)
  const [linkTokenError, setLinkTokenError] = useState(null)
  const [isFetchingLinkToken, setIsFetchingLinkToken] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)

  const onSuccessRef = useRef(null)

  const retryLinkToken = useCallback(() => {
    setLinkToken(null)
    setLinkTokenError(null)
    setTokenRefreshKey((key) => key + 1)
  }, [])

  useEffect(() => {
    onSuccessRef.current = async (public_token) => {
      setIsExchanging(true)
      showToast('Bank connected — syncing your transactions…', 'info')

      try {
        const priorAccountCount = getCachedAccountCount(queryClient)
        const token = await getToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/exchange-public-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_token }),
        })
        const data = await response.json()

        if (response.ok && data.success) {
          const count = data.accountsConnected ?? 0
          const synced = data.synced
          const syncDetail =
            synced != null
              ? ` — synced ${synced.added} new transaction${synced.added === 1 ? '' : 's'}`
              : ''
          showToast(
            `Connected ${count} account${count === 1 ? '' : 's'}${syncDetail}`,
            'success'
          )

          if (priorAccountCount === 0 && count > 0) {
            markFirstConnectCelebration({
              accountsConnected: count,
              syncedAdded: synced?.added ?? 0,
            })
          }

          await invalidateAfterAccountChange(queryClient)
        } else {
          console.error('Failed to connect bank account:', data.error || response.status)
          showToast(data.error || 'Couldn’t connect your bank — please try again', 'error')
        }
      } catch (err) {
        console.error('Failed to connect bank account:', err.message)
        captureClientError(err, { label: 'plaid_exchange' })
        showToast('Couldn’t connect your bank — please try again', 'error')
      } finally {
        setIsExchanging(false)
      }
    }
  }, [getToken, queryClient, showToast])

  useEffect(() => {
    if (!isSignedIn) {
      setLinkToken(null)
      setLinkTokenError(null)
      setIsFetchingLinkToken(false)
      return
    }

    let cancelled = false

    async function fetchLinkToken() {
      setIsFetchingLinkToken(true)
      setLinkTokenError(null)

      try {
        const token = await getToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/create-link-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data.link_token) {
          const message =
            data.error || `Couldn’t prepare bank connection (${response.status || 'network error'})`
          if (!cancelled) {
            setLinkToken(null)
            setLinkTokenError(message)
            showToast(message, 'error')
          }
          return
        }

        if (!cancelled) {
          setLinkToken(data.link_token)
          setLinkTokenError(null)
        }
      } catch (err) {
        console.error('Failed to create Plaid link token:', err.message)
        captureClientError(err, { label: 'plaid_link_token' })
        if (!cancelled) {
          setLinkToken(null)
          setLinkTokenError('Couldn’t prepare bank connection — please try again')
          showToast('Couldn’t prepare bank connection — please try again', 'error')
        }
      } finally {
        if (!cancelled) {
          setIsFetchingLinkToken(false)
        }
      }
    }

    fetchLinkToken()

    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken, showToast, tokenRefreshKey])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => onSuccessRef.current?.(public_token),
  })

  return (
    <PlaidLinkContext.Provider
      value={{
        open,
        ready: ready && !!linkToken && !isExchanging && !linkTokenError,
        isExchanging,
        isFetchingLinkToken,
        linkTokenError,
        retryLinkToken,
      }}
    >
      {children}
    </PlaidLinkContext.Provider>
  )
}

export function usePlaidLinkContext() {
  const context = useContext(PlaidLinkContext)
  if (!context) {
    throw new Error('usePlaidLinkContext must be used within PlaidLinkProvider')
  }
  return context
}
