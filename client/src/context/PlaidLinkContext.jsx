/*
 * PLAID LINK CONTEXT
 *
 * Keeps a single usePlaidLink instance for the whole app.
 * Plaid's script must only be embedded once per page.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '@clerk/clerk-react'

const PlaidLinkContext = createContext(null)

export function PlaidLinkProvider({ children }) {
  const { getToken, isSignedIn } = useAuth()
  const [linkToken, setLinkToken] = useState(null)

  const onSuccessRef = useRef(null)

  useEffect(() => {
    onSuccessRef.current = async (public_token) => {
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
      console.log(data)
    }
  }, [getToken])

  useEffect(() => {
    if (!isSignedIn) {
      setLinkToken(null)
      return
    }

    let cancelled = false

    async function fetchLinkToken() {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (!cancelled) {
        setLinkToken(data.link_token)
      }
    }

    fetchLinkToken()

    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => onSuccessRef.current?.(public_token),
  })

  return (
    <PlaidLinkContext.Provider value={{ open, ready: ready && !!linkToken }}>
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
