/*
 * PLAID LINK CONTEXT
 *
 * Keeps a single usePlaidLink instance for the whole app.
 * Plaid's script must only be embedded once per page — and only after sign-in,
 * so anonymous marketing visitors never download link-initialize.js.
 *
 * What this file does:
 * - Fetches a Plaid link_token when the user is signed in
 * - Exposes open/ready/error/retry so Connect Bank can recover from failures
 * - On successful bank link, invalidates dashboard + trackers + expense + alerts
 *
 * Fetch is keyed only on sign-in + manual retry — not on Clerk getToken identity,
 * which changes often and would burn the create-link-token rate limit.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAfterAccountChange } from '../lib/queryKeys.js'
import { getCachedAccountCount, markFirstConnectCelebration } from '../lib/firstConnectCelebration.js'
import { ensurePlaidLinkScript } from '../lib/ensurePlaidLinkScript.js'
import { useToastContext } from './ToastContext.jsx'
import { captureClientError } from '../lib/sentry.js'
import { trackFunnelBankLinked } from '../lib/analytics.js'
import { authHeaders } from '../lib/apiRequest.js'

const PlaidLinkContext = createContext(null)

const SIGNED_OUT_VALUE = {
  open: () => {},
  ready: false,
  isExchanging: false,
  isFetchingLinkToken: false,
  linkTokenError: null,
  retryLinkToken: () => {},
}

/**
 * Signed-in half of the provider — mounts usePlaidLink only when needed,
 * which also keeps react-plaid-link from injecting the CDN script on `/`.
 */
function PlaidLinkSignedInProvider({ children }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()
  const [scriptReady, setScriptReady] = useState(() => typeof window !== 'undefined' && !!window.Plaid)
  const [linkToken, setLinkToken] = useState(null)
  const [linkTokenError, setLinkTokenError] = useState(null)
  const [isFetchingLinkToken, setIsFetchingLinkToken] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0)

  const onSuccessRef = useRef(null)
  const getTokenRef = useRef(getToken)
  const showToastRef = useRef(showToast)
  const inFlightRef = useRef(false)
  const fetchGenerationRef = useRef(0)

  useEffect(() => {
    getTokenRef.current = getToken
  }, [getToken])

  useEffect(() => {
    showToastRef.current = showToast
  }, [showToast])

  useEffect(() => {
    let cancelled = false

    ensurePlaidLinkScript()
      .then(() => {
        if (!cancelled) {
          setScriptReady(true)
        }
      })
      .catch((err) => {
        console.error('Failed to load Plaid Link script:', err.message)
        captureClientError(err, { label: 'plaid_script' })
        if (!cancelled) {
          setLinkTokenError('Couldn’t load bank connection — please refresh and try again')
          showToastRef.current('Couldn’t load bank connection — please refresh and try again', 'error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const retryLinkToken = useCallback(() => {
    setLinkToken(null)
    setLinkTokenError(null)
    setTokenRefreshKey((key) => key + 1)
  }, [])

  useEffect(() => {
    onSuccessRef.current = async (public_token) => {
      setIsExchanging(true)
      showToastRef.current('Bank connected — syncing your transactions…', 'info')

      try {
        const priorAccountCount = getCachedAccountCount(queryClient)
        const token = await getTokenRef.current()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/exchange-public-token`, {
          method: 'POST',
          headers: authHeaders(token, { 'Content-Type': 'application/json' }),
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
          showToastRef.current(
            `Connected ${count} account${count === 1 ? '' : 's'}${syncDetail}`,
            'success'
          )

          trackFunnelBankLinked({ accountsConnected: count })

          if (priorAccountCount === 0 && count > 0) {
            markFirstConnectCelebration({
              accountsConnected: count,
              syncedAdded: synced?.added ?? 0,
            })
          }

          await invalidateAfterAccountChange(queryClient)
        } else {
          console.error('Failed to connect bank account:', data.error || response.status)
          showToastRef.current(data.error || 'Couldn’t connect your bank — please try again', 'error')
        }
      } catch (err) {
        console.error('Failed to connect bank account:', err.message)
        captureClientError(err, { label: 'plaid_exchange' })
        showToastRef.current('Couldn’t connect your bank — please try again', 'error')
      } finally {
        setIsExchanging(false)
      }
    }
  }, [queryClient])

  useEffect(() => {
    if (!scriptReady) {
      return
    }

    let cancelled = false
    const requestId = ++fetchGenerationRef.current

    async function fetchLinkToken() {
      inFlightRef.current = true
      setIsFetchingLinkToken(true)
      setLinkTokenError(null)

      try {
        const token = await getTokenRef.current()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/create-link-token`, {
          method: 'POST',
          headers: authHeaders(token),
        })

        const data = await response.json().catch(() => ({}))

        if (cancelled || requestId !== fetchGenerationRef.current) {
          return
        }

        if (!response.ok || !data.link_token) {
          const isRateLimited = response.status === 429 || data.error === 'rate_limit_exceeded'
          const message = isRateLimited
            ? 'Too many bank-connection attempts — wait a bit, then tap Retry.'
            : data.message ||
              data.error ||
              `Couldn’t prepare bank connection (${response.status || 'network error'})`
          setLinkToken(null)
          setLinkTokenError(message)
          showToastRef.current(message, 'error')
          return
        }

        setLinkToken(data.link_token)
        setLinkTokenError(null)
      } catch (err) {
        console.error('Failed to create Plaid link token:', err.message)
        captureClientError(err, { label: 'plaid_link_token' })
        if (!cancelled && requestId === fetchGenerationRef.current) {
          setLinkToken(null)
          setLinkTokenError('Couldn’t prepare bank connection — please try again')
          showToastRef.current('Couldn’t prepare bank connection — please try again', 'error')
        }
      } finally {
        if (requestId === fetchGenerationRef.current) {
          inFlightRef.current = false
          if (!cancelled) {
            setIsFetchingLinkToken(false)
          }
        }
      }
    }

    fetchLinkToken()

    return () => {
      cancelled = true
    }
  }, [scriptReady, tokenRefreshKey])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => onSuccessRef.current?.(public_token),
  })

  return (
    <PlaidLinkContext.Provider
      value={{
        open,
        ready: ready && scriptReady && !!linkToken && !isExchanging && !linkTokenError,
        isExchanging,
        isFetchingLinkToken: isFetchingLinkToken || !scriptReady,
        linkTokenError,
        retryLinkToken,
      }}
    >
      {children}
    </PlaidLinkContext.Provider>
  )
}

export function PlaidLinkProvider({ children }) {
  const { isSignedIn } = useAuth()

  if (!isSignedIn) {
    return (
      <PlaidLinkContext.Provider value={SIGNED_OUT_VALUE}>{children}</PlaidLinkContext.Provider>
    )
  }

  return <PlaidLinkSignedInProvider>{children}</PlaidLinkSignedInProvider>
}

export function usePlaidLinkContext() {
  const context = useContext(PlaidLinkContext)
  if (!context) {
    throw new Error('usePlaidLinkContext must be used within a PlaidLinkProvider')
  }
  return context
}
